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
  if (socketId === 'test') {
    let keys = Object.keys(io.sockets.sockets)
    return io.sockets.sockets[keys[0]]
  }
  return io.sockets.sockets[socketId]
}

function userJoinGame(username, gamename, socketId) {
  var socket = findSocketById(socketId)
  if (!socket) {
    throw new Error(`socket id is not connected.`)
  }
  let game = findGame(gamename)
  if (game.round != 0) {
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
    poison: true,
    antidote: true,
    sheriffRunning: false,
    sheriff: false,
    protected: false,
    lastProtect: '',
    hunterKilled: '',
    lastAttacked: '',
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
        sheriffRunning: u.sheriffRunning,
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
  if (game.round != 0) {
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
      round: 0,
      roundState: 'roleCheck', // waiting for what to be voted. sheriff, night kill, day kill,
      lastKilled: [], // list of deaths this round
      voteKilled: '', // Who died by vote
      sheriffAlive: true,
      users: [], // username => user
      waiting: [], // users waiting for action
      sheriffList: [],
      votes: {}, // username: votes
      ready: false
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
  let gameOptions = req.body
  let game = findGame(req.session.game)
  game.rule = gameOptions.gameType
  game.options = gameOptions
  if (game.round != 0) {
    res.status(400).json({ message: 'game already started' })
    return
  }
  game.round = 1
  io.to(game.name).emit('start')
  if(assignRoles(game, req.body) === 0) res.json({ success: true })
  else res.json({ success: false, message: "Bad Role Settings" })
  game.waiting = getUsers(game.users, "nightStart")
  io.to(game.name).emit("gameState", { state: "roleCheck" })
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

function getUsers(users, state) {
  var check = ((state === "witchsave") || (state === "witchkill")) ? "witch" : state
  check = (state === "hunterdeath") ? "hunter" : check
  return users.filter((user) => {
    if(!user.alive) return false // Dead don't participate in anything
    if(check === "killVote" && user.revealedIdiot) return false // Idiot can't vote after revealed
    if(check === "sheriffVote" && !user.sheriffRunning) return false // Sheriff votes only people who aren't running
    if(check === "nightStart" || check === "dayStart" ||
       check === "killVote" || check === "sheriffNom" || check === "sheriffVote") return true // Everyone participates in these events
    if(user.role === "hunter" && state === "hunterdeath" && game.hunterKilled) return true // Check if hunter died
    if(user.role === check) return true // Get by role
    if(state === "sheriff" && user.sheriff && !game.sheriffAlive) return true // Check if sheriff died
    return false
  })
}

function maxProp(obj) {
  return Object.keys(obj).reduce((a, b) => obj[a] > obj[b] ? a : b)
}

function playGame(game) {
  // Waiting list should be empty when this starts
  let roundList = ['nightStart', 'guard', 'wolf', 'witchsave', 'witchkill',
    'prophet', 'hunter', 'sheriffNom', 'sheriffVote', 'dayStart', 'killVote', 'hunterdeath', 'sheriff']
  if (game.ready) {
    // Deal with votes and move on
    // Unless no votes
    game.sheriffAlive = true
    if(game.votes.length > 0) {
      var user = findUserInGame(maxProp(game.votes), game.name) // Get max voted
      game.votes = [] // reset votes
      switch(game.roundState) {
        case 'sheriffNom':
          for(user in game.votes) findUserInGame(user, game.name).sheriffRunning = true
          break
        case 'sheriffVote':
        case 'dayStart': // Sheriff Vote
        case 'sheriff':
          user.sheriff == true;
          break
        case 'guard':
          user.protected = true
          getUsers(game.users, 'guard')[0].lastProtect = maxProp(game.votes)
          break;
        case 'wolf':
          if(!user.protected) {
            if(user.role === "hunter") user.hunterKilled = true
            if(user.sheriff) game.sheriffAlive = false
            game.lastKilled.push(user.name)
            getUsers(game.users, "witch")[0].lastAttacked = user.name
          }
          break;
        case 'witchsave':
          if(user.protected) {
            game.lastKilled.push(user.name)
            if(user.sheriff) game.sheriffAlive = false
          } else {
            if(findUserInGame(game.lastKilled.pop(), game.name).sheriff) game.sheriffAlive = true // Revive and check sheriff
          }
          getUsers(game.users, 'witch')[0].antidote = false
          break;
        case 'witchkill':
          getUsers(game.users, 'witch')[0].poison = false
        case 'hunter':
        case 'killVote':
        case 'hunterDeath':
          if(user.role === "hunter") user.hunterKilled = true
          if(user.sheriff) game.sheriffAlive = false
          user.alive = false
          if(game.roundState === 'killVote') {
            if(user.role == "idiot") {
              user.revealedIdiot = true
            } else game.voteKilled = user.name
          }
          else game.lastKilled.push(user.name)
      }
    }
    if(game.roundState === "roleCheck")
      game.roundState = "nightStart"
    else
      game.roundState = roundList[roundList.indexOf(game.roundState) == roundList.length - 1 ? 0 : roundList.indexOf(game.roundState) + 1]
    game.ready = false
    playGame(game) // Go to next stage
  } else {
    game.waiting = getUsers(game.users, game.roundState) // Get users for this round
    if(game.waiting.length === 0) { // Nobody needs to go OR its the last hunter round and hunter didn't die
      // Skip this round
      console.log(`skip round ${game.roundState}`)
      game.roundState = roundList[roundList.indexOf(game.roundState) == roundList.length - 1 ? 0 : roundList.indexOf(game.roundState) + 1]
      game.ready = false
      playGame(game) // Go to next stage
    } else {
      console.log(game.roundState)
      if(game.roundState == "dayStart" && checkEnd(game)) {
        io.to(game.name).emit("gameOver", { winState: checkEnd(game) })
      } else {
        io.to(game.name).emit("gameState", { state: game.roundState, round: game.round })
      }
    }
  }
}

function checkEnd(game) {
  // 0 = not ended, 1 = wolf win, 2 = wolf loss
  if(getUsers(game.users, "wolf").filter((user) => { return user.alive }).length === 0) return 2
  if(game.rule === "killAll") { // All dead
    if(game.users.filter((user) => { return user.role != "wolf" && user.alive }).length === 0) return 1
  }
  if(game.rule === "killSide") { // All villagers dead or all specials dead
    if(game.users.filter((user) => { return user.role == "villager" && user.alive }).length === 0 ||
       game.users.filter((user) => { return user.role != "wolf" && user.role != "villager" && user.alive }).length === 0) return 1
  }
  return 0
}

/**
 * Sets vote and checks validity and sends wolfness if prophet
 */
function vote(req, res) {
  var game = findGame(req.session.game)
  var vote = req.body.vote
  var user = findUserInGame(req.session.user, req.session.game)

  // Check Validity based on round
  switch(game.roundState) {
    case "guard":
      if(user.lastProtect === vote) {
        res.json({ success: false, message: "Protected last round"})
        return
      }
      break
    case "witchsave":
      if(lastAttacked === user.name && game.round !== 1) {
        res.json({ success: false, message: "Can't save self"})
        return
      }
      if(lastAttacked !== vote) {
        res.json({ success: false, message: "Can't save person not killed by wolves"})
        return
      }
      break
    case "witchkill": // Kill
      if(vote == user.name) {
        res.json({ success: false, message: "Can't poison self"})
        return
      }
      break
  }

  if(!(vote in game.votes)) game.votes[vote] = 0;
  game.votes[vote] += user.sheriff ? 1.5 : 1;
  if(game.roundState === 'prophet') res.json({ success: true , wolf: findUserInGame(vote, req.session.game).role === 'wolf'})
  else res.json({ success: true })
}

/** Removes user from waiting list and runs next section if waiting for nobody
 */
function ready(req, res) {
  var info = req.body
  var user = req.session.user
  console.log(`READY: user : ${user}, info: ${JSON.stringify(info)} `)
  var game = findGame(req.session.game)
  //console.log(JSON.stringify(game.waiting))
  game.waiting = game.waiting.filter(u => { return u.name !== req.session.user} )
  res.json({ success: true })
  if(game.waiting.length == 0) {
    game.ready = true
    playGame(game)
  }
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
