var app = require('express')();
var http = require('http').createServer(app);
var session = require('express-session')
var io = require('socket.io')(http);

var bodyParser = require('body-parser')
var sharedsession = require("express-socket.io-session");
var assert = require('assert')

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
  if (game.status != -1) {
    throw new Error(`Game ${gamename} cannot be joined because it is not open.`)
  }
  let user = game.users.find(u => { return u.name == username })
  if (user) {
    throw new Error(`You are already in ${gamename}`)
  }

  let isOrganizer = false
  if (game.users.length == 0) {
    isOrganizer = true
  }
  game.users.push({
    name: username,
    role: null,
    alive: true,
    poison: false,
    antidote: false,
    sheriffVoteStatus: null,
    sheriff: false,
    canShoot: false, // for hunter
    protected: false,
    lastProtect: '',
    revealedIdiot: false,
    isOrganizer: isOrganizer,
  })

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
  let users = game.users
  let roleArray = []
  Object.keys(roleCounts).forEach(role => {
    let count = roleCounts[role]
    for (let i = 0; i < count; i++) {
      roleArray.push(role)
    }
  })
  roleArray = shuffle(roleArray)
  for (let i = 0; i < users.length; i++) {
    users[i].role = roleArray[i]
    console.log(users[i].name, users[i].role)
  }
}

function getGameDetails(gamename) {
  let game = findGame(gamename)
  return {
    name: game.name,
    status: game.status,
    users: game.users.map(u => {
      return {
        name: u.name,
        isOrganizer: u.isOrganizer,
        alive: u.alive,
        sheriffVoteStatus: u.sheriffVoteStatus,
        sheriff: u.sheriff,
        revealedIdiot: u.revealedIdiot
      }
    }),
    round: game.round,
    roundState: game.roundState
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
  let user = game.users.find(u => { return u.name == username })
  if (!user) {
    throw new Error(`${username} is not in ${gamename}`)
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

function _leaveGame(req, socketId) {
  var socket = findSocketById(socketId)
  var username = req.session.user
  var gamename = req.session.game
  let game = findGame(gamename)
  if (game.status != 0) {
    throw new Error(`Game ${gamename} is in progress, you cannot leave.`)
  }
  let users = game.users
  let user = users.find(u => { return u.name == username })
  if (!user) {
    throw new Error(`You are not in Game ${gamename}.`)
  }
  delete req.session.game
  if (users.length == 1) {
    delGame(game.name)
    if (socket) delete socketGameUserMap[socket.id]
    return
  }
  if (user.isOrganizer) {
    var newOrganizer = users.find(u => { return !u.isOrganizer })
    if (newOrganizer) {
      newOrganizer.isOrganizer = true
    }
  }
  let index = users.indexOf(user)
  users.splice(index, 1)
  if (socket) delete socketGameUserMap[socket.id]
  io.to(game.name).emit('message', { type: 'warning', message: `${user.name} left.` })
  if (user.isOrganizer && newOrganizer) {
    io.to(game.name).emit('message', { type: 'info', message: `${newOrganizer.name} is promoted.` })
  }
  io.to(game.name).emit('refresh', null)
}

function leaveGame(req, res) {
  var info = req.body
  try {
    _leaveGame(req, info.socket)
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
      rule: '', // 屠边 屠城
      round: 1,
      roundState: {
        state: 'nightStart',
        part: 0
      }, // waiting for what to be voted. sheriff, night kill, day kill,
      lastAttacked: '', // last person attacked by wolf
      users: [], // username => user
      waiting: [], // users waiting for action
      votes: {} // username: votes
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
  if (game.status != -1) {
    res.status(400).json({ message: 'game already started' })
    return
  }
  let counts = {
    2: { wolf: 1, villager: 1 },
    3: { wolf: 1, villager: 2 },
    4: { wolf: 1, villager: 3 },
    5: { wolf: 1, villager: 4 },
    6: { wolf: 2, villager: 2, witch: 1, prophet: 1 },
    7: { wolf: 2, villager: 2, witch: 1, prophet: 1, hunter: 1 },
    8: { wolf: 2, villager: 3, witch: 1, prophet: 1, hunter: 1 },
    9: { wolf: 3, villager: 3, witch: 1, prophet: 1, hunter: 1 },
    10: { wolf: 3, villager: 3, idiot: 1, witch: 1, prophet: 1, hunter: 1 },
    11: { wolf: 4, villager: 3, idiot: 1, witch: 1, prophet: 1, hunter: 1 },
    12: { wolf: 4, villager: 4, idiot: 1, witch: 1, prophet: 1, hunter: 1 }
  }
  assignRoles(game, counts[game.users.length])
  game.status = 0 // vote for sheriff
  game.voteFor = 'sheriff'
  game.voteRound = 1
  io.to(game.name).emit('start')
  if(assignRoles(game, req.body) === 0) res.json({ success: true })
  else res.json({ success: false, message: "Bad Role Settings" })
  playGame(game)
}

function assignRoles(game, data) {
  let users = game.users
  let roleArray = []
  for(let _ = 0; _ < data.wolfCount; _++) {
    roleArray.push("wolf")
  }
  if(data.witch) roleArray.push("witch")
  if(data.prophet) roleArray.push("prophet")
  if(data.hunter) roleArray.push("hunter")
  if(data.guard) roleArray.push("guard")
  if(data.idiot) roleArray.push("idiot")
  if(roleArray.length > users.length) {
    return 1
  }
  while(roleArray.length < users.length) {
    roleArray.push("villager")
  }
  shuffle(roleArray)
  for(let i = 0; i < users.length; i++) {
    users[i].role = roleArray[i]
  }
  return 0
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

function getUsers(users, role) {
  var out = []
  users.forEach((user) => {
    if(role === "all") out.push(user)
    else if(user.role === role) {
      out.push(user)
      break
    }
  })
  return out
}

function playGame(game) {
  // Waiting list should be empty when this starts
  switch(game.roundState.state) {
    case 'nightStart': // Announce night, everyone close eyes
      game.waiting = getUsers(game.users, "all")
      game.roundState.state = 'guard'
      io.to(game.gamename).emit("gameState", { type: "nightStart"})
      break;
    case 'guard': // Guard open eyes, guard a player, close eyes
      game.waiting = getUsers(game.users, "guard")
      game.roundState.state = 'wolves'
      if(game.waiting.length === 0) {
        playGame(game) // Skip to next stage
      } else {
        io.to(game.gamename).emit("gameState", { type: "guard"})
      }
      break;
    case 'wolves': // All wolves open eyes, vote kill a player, close eyes
      game.waiting = getUsers(game.users, "wolf")
      game.roundState.state = 'witch'
      if(game.waiting.length === 0) {
        playGame(game) // Skip to next stage
      } else {
        io.to(game.gamename).emit("gameState", { type: "guard"})
      }
      break;
    case 'witch': // Witch open eyes, save/kill/do nothing, close eyes
      game.waiting = getUsers(game.users, "witch")
      if(game.waiting.length === 0) {
        game.roundState.state = 'prophet'
        playGame(game) // Skip to next stage
      } else {
        switch(game.roundState.part) {
          case 1:
            io.to(game.gamename).emit("gameState", { type: "guard"})
        }
      }
      break;
    case 'prophet': // Prophet open eyes, check a player, close eyes
      game.waiting = getUsers(game.users, "prophet")
      game.roundState.state = 'hunter'
      if(game.waiting.length === 0) {
        playGame(game) // Skip to next stage
      } else {
        io.to(game.gamename).emit("gameState", { type: "guard"})
      }
      break;
    case 'hunter': // Hunter open eyes, kill/do nothing, close eyes
      game.waiting = getUsers(game.users, "hunter")
      game.roundState.state = 'dayStart'
      if(game.waiting.length === 0) {
        playGame(game) // Skip to next stage
      } else {
        io.to(game.gamename).emit("gameState", { type: "guard"})
      }
      break;
    case 'dayStart': // Annouce day, everyone open eyes
      break;
    case 'deathList': // Everyone see who died last night
      break;
    case 'speech': // Each player in turn give a speech
      break;
    case 'killVote': // Everyone vote to kill a player.
      break;
    case 'lastWords': // Eliminated player has a chance to give a speech.
      break;
  }
}

function vote(req, res) {
  var game = findGame(req.session.game)
  var vote = req.body.vote
  if(!(vote in game.votes)) game.votes[vote] = 0;
  game.votes[vote]++;
  res.json({ success: true })
}

/** Removes user from waiting list and runs next section if waiting for nobody
 */
function ready(req, res) {
  var game = findGame(req.session.game)
  game.waiting.splice(game.indexOf(req.session.user), 1)
  res.json({ success: true })
  if(game.waiting.length == 0) playGame(game)
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
  res.json({ success: true })
}

function logout(req, res) {
  try {
    let username = req.session.user
    let sockets = []
    Object.keys(socketGameUserMap).forEach(socketId => {
      let { user, game } = socketGameUserMap[socketId]
      if (user == username) {
        sockets.push({ id: socketId, game: game })
      }
    })
    sockets.forEach(socket => {
      console.log(`${username} leave ${socket.game}`)
      _leaveGame(req, socket.id)
    })
    delete req.session.user
    delete req.session.game
    res.json({ success: true })
  } catch (error) {
    res.status(400).json({ message: error.message })
  }
}

function getMyRole(req, res) {
  try {
    let username = req.session.user
    let gamename = req.session.game
    let game = findGame(gamename)
    let user = game.users.find(u => { return u.name == username })
    return res.json(user)
  } catch (error) {
    return res.status(400).json({ message: error.message })
  }
}

app.post('/api/login', login)
app.post('/api/logout', logout)
app.post('/api/join', joinGame)
app.post('/api/leave', leaveGame)
app.post('/api/create', createGame)
app.post('/api/chat', chat)
app.post('/api/start', startGame)
app.post('/api/vote', vote)
app.get('/api/myrole', getMyRole)
app.post('/api/ready', ready)

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
