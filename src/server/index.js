var app = require('express')();
var http = require('http').createServer(app);
var io = require('socket.io')(http);
var session = require('express-session')
var bodyParser = require('body-parser')
var sharedsession = require("express-socket.io-session");
var assert = require('assert')


var translates = {
  roles: {villager: '平民', wolf: '狼人', witch: '女巫', fortuneTeller: '预言家', hunter: '猎人', guard: '守卫', idiot: '白痴'}
}

var roles = ['villager', 'wolf', 'witch', 'fortuneTeller', 'hunter', 'guard', 'idiot']

var games = {} // each game is a namespaces. a game has a users list
var socketGameUserMap = {} // socket.id => {socket, game, user}

var sess = {
  secret: 'wolf man game super weak secret session',
  cookie: {},
  resave: true,
  saveUninitialized: true
}

if (app.get('env') === 'production') {
  app.set('trust proxy', 1) // trust first proxy
  sess.cookie.secure = true // serve secure cookies
}

var sessionMiddleware = session(sess)
app.use(sessionMiddleware)

// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: false }))

// parse application/json
app.use(bodyParser.json())

io.use(sharedsession(sessionMiddleware, {
  autoSave: true
}))

io.on('connection', function (socket) {
  console.log(`user : ${socket.handshake.session.user}, game: ${socket.handshake.session.game}`)
  console.log('a user connected');
  try {
    let username = socket.handshake.session.user
    let gamename = socket.handshake.session.game
    if (username && gamename) {
      let game = findGame(gamename)
      let user = findUserInGame(username, gamename)
      console.log(`${user.name} relogged in ${game.name}`)
      socket.join(game.name)
      socketGameUserMap[socket.id] = { game: game.name, user: user.name }
    }
  } catch (error) {
    console.log(error.message)
  }

  socket.on('disconnect', function () {
    console.log('user disconnected');
    delete socketGameUserMap[socket.id]
  })

})


function delGame(gamename) {
  findGame(gamename)
  delete games[gamename]
  io.to(gamename).emit('message', { type: 'warning', message: `Last user left. ${gamename} deleted` })
}

function findSocketById(socketId) {
  assert(typeof socketId == 'string')
  return io.sockets.sockets[socketId]
}

function userJoinGame(username, gamename, socketId) {
  var socket = findSocketById(socketId)
  if (!socket) {
    throw new Error(`socket id is not connected.`)
  }
  let game = findGame(gamename)
  if (game.status != 0) {
    throw new Error(`Game ${gamename} cannot be joined because it is not open.`)
  }
  if (game.users[username]) {
    throw new Error(`You are already in ${gamename}`)
  }

  let isOrganizer = false
  if (Object.keys(game.users) == 0) {
    isOrganizer = true
  }
  game.users[username] = {
    name: username,
    role: null,
    live: true,
    poison: 0,
    antidote: 0,
    vote: '',
    runSheriff: false,
    quitRunSheriff: false,
    sheriff: false,
    canShoot: true, // for hunter
    protect: '',
    lastProtect: '',
    revealedIdot: false,
    isOrganizer: isOrganizer
  }

  socket.join(game.name)
  socketGameUserMap[socket.id] = { game: game.name, user: username }
  let message = `${username} joined game ${gamename}`
  console.log(message)
  io.to(game.name).emit('message', { type: 'info', message: message })
  io.to(game.name).emit('refresh', null)
}

function shuffle(array) {
  var currentIndex = array.length, temporaryValue, randomIndex;

  // While there remain elements to shuffle...
  while (0 !== currentIndex) {

    // Pick a remaining element...
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex -= 1;

    // And swap it with the current element.
    temporaryValue = array[currentIndex];
    array[currentIndex] = array[randomIndex];
    array[randomIndex] = temporaryValue;
  }

  return array;
}

function assignRoles(game, roleCounts) {
  let users = Object.values(game.users)
  let roleArray = []
  Object.keys(roleCounts).forEach(role => {
    let count = roleCounts[role]
    for (let i = 0; i < count; i++) {
      roleArray.push(role)
    }
  })
  roleArray = shuffle(roleArray)
  for(let i = 0; i< users.length; i++) {
    users[i].role = roleArray[i]
    console.log(users[i].name, users[i].role)
  }
}

function getGameDetails(gamename) {
  let game = findGame(gamename)
  return {
    name: game.name,
    status: game.status,
    users: Object.values(game.users).map(u => {
      return { 
        name: u.name, 
        isOrganizer: u.isOrganizer,
        live: u.live,
        runSheriff: u.runSheriff,
        quitRunSheriff: u.quitRunSheriff,
        sheriff: u.sheriff,
        revealedIdot: u.revealedIdot
       }
    })
  }
}

function findGame(gamename) {
  let game = games[gamename]
  if (!game) {
    throw new Error(`Game ${gamename} does not exist`)
  }
  return game
}

function findUserInGame(username, gamename) {
  let game = findGame(gamename)
  let user = game.users[username]
  if (!user) {
    throw new Error(`You are already in ${gamename}`)
  }
  return user
}



function saveUserGameToSession(req, user, game) {
  req.session.user = user
  if (game) {
    req.session.game = game
  }
}

function vote(req, res) {
  
}

function joinGame(req, res) {
  var info = req.body
  try {
    var user = req.session.user
    userJoinGame(user, info.game, info.socket)
    saveUserGameToSession(req, user, info.game)
    res.json({ success: true })
  } catch (error) {
    res.status(400).json({ message: error.message })
    return
  }
}

function leaveGame(req, res) {
  var info = req.body
  try {
    var socket = findSocketById(info.socket)
    var username = req.session.user
    var gamename = req.session.game
    if (!socket) {
      throw new Error(`socket id is not connected.`)
    }
    let game = findGame(gamename)
    if (game.status != 0) {
      throw new Error(`Game ${gamename} is in progress, you cannot leave.`)
    }
    let users = game.users
    let user = users[username]
    if (!user) {
      throw new Error(`You are not in Game ${gamename}.`)
    }
    delete req.session.game
    if (Object.values(users).length == 1) {
      delGame(game.name)
      delete socketGameUserMap[socket.id]
      return
    }
    if (user.isOrganizer) {
      var newOrganizer = Object.values(users).find(u => { return !u.isOrganizer })
      if (newOrganizer) {
        newOrganizer.isOrganizer = true
      }
    }
    delete users[username]
    delete socketGameUserMap[socket.id]
    io.to(game.name).emit('message', { type: 'warning', message: `${user.name} left.` })
    if (user.isOrganizer && newOrganizer) {
      io.to(game.name).emit('message', { type: 'info', message: `${newOrganizer.name} is promoted.` })
    }
    io.to(game.name).emit('refresh', null)
    res.json({ success: true })
  } catch (error) {
    res.status(400).json({ message: error.message })
  }
}


function createGame(req, res) {
  var info = req.body
  try {
    var socket = findSocketById(info.socket)
    var gamename = info.game
    var username = req.session.user
    if (!socket) {
      throw new Error(`socket id is not connected.`)
    }
    if (games[gamename]) {
      throw new Error(`Game name ${gamename} is taken`)
    }
    games[gamename] = {
      name: gamename,
      status: 0, // 0, 1, 2, 3, 4 ... odd: night, even: day. 0: waiting
      users: {} // username => user
    }
    userJoinGame(username, gamename, socket.id)
    saveUserGameToSession(req, username, gamename)
    res.json({ success: true })
  } catch (error) {
    res.status(400).json({ message: error.message })
    return
  }
}

function startGame(req, res) {
  let info = req.body
  let game = findGame(req.session.game)
  if (game.status != 0) {
    res.status(400).json({message: 'game already started'})
    return
  }
  let counts = {
    2: {wolf: 1, villager: 1},
    3: {wolf: 1, villager: 2},
    4: {wolf: 1, villager: 3},
    5: {wolf: 1, villager: 4},
    6: {wolf: 1, villager: 3, witch: 1, fortuneTeller: 1},
    7: {wolf: 2, villager: 3, witch: 1, fortuneTeller: 1},
    8: {wolf: 2, villager: 3, witch: 1, fortuneTeller: 1, idiot: 1},
    9: {wolf: 3, villager: 3, witch: 1, fortuneTeller: 1, guard: 1},
    10: {wolf: 3, villager: 3, idiot: 1, witch: 1, fortuneTeller: 1, guard: 1},
    11: {wolf: 4, villager: 3, idiot: 1, witch: 1, fortuneTeller: 1, guard: 1},
    12: {wolf: 4, villager: 4, idiot: 1, witch: 1, fortuneTeller: 1, guard: 1}
  }
  assignRoles(game, counts[Object.keys(game.users).length])
  io.to(game.name).emit('start')
  res.json({success: true})
}

function chat(req, res) {
  var chat = req.body
  console.log(`got chat ${chat.message} from socket ${chat.socket}`)
  console.log(socketGameUserMap)
  if (!socketGameUserMap[chat.socket]) {
    res.status(400).json({ message: `socket ${chat.socket} does not exist` })
    return
  }
  let { user, game } = socketGameUserMap[chat.socket]
  console.log(`${user} send to ${game}`)
  let from = user
  let room = game
  io.to(room).emit('chat', { from: from, message: chat.message })
  res.json({ success: true })
}

function login(req, res) {
  var info = req.body
  saveUserGameToSession(req, info.user)
  res.json({success: true})
}

app.post('/api/login', login)
app.post('/api/join', joinGame)
app.post('/api/leave', leaveGame)
app.post('/api/create', createGame)
app.post('/api/chat', chat)
app.post('/api/start', startGame)
app.post('/api/vote', vote)

app.get('/api/game', function (req, res) {
  let gamename = req.session.game
  console.log(`get game ${gamename}`)
  try {
    let game = getGameDetails(gamename)
    res.json(game)
  } catch (error) {
    res.status(400).json({ message: error.message })
  }
})

app.get('/api/me', function (req, res) {
  res.json({ username: req.session.user, gamename: req.session.game })
})


var port = 3100
http.listen(port, function () {
  console.log(`listening on *:${port}`);
});