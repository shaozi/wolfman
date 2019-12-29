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
    protect: '',
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
    console.error(`Game ${gamename} does not exist`)
    return {}
  }
  return game
}

function findUserInGame(username, gamename) {
  let game = findGame(gamename)
  let user = game.users.find(u => { return u.name == username })
  if (!user) {
    console.error(`${username} is not in ${gamename}`)
    return {}
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
  if (assignRoles(game, req.body) === 0) res.json({ success: true })
  else res.json({ success: false, message: "Bad Role Settings" })
  game.waiting = getUsers(game, "nightStart")
  io.to(game.name).emit("gameState", { state: "roleCheck" })
}

function restartGame(req, res) {
  let game = findGame(req.session.game)
  Object.assign(game, {
    rule: '', // 屠边 屠城
    round: 0,
    roundState: 'roleCheck', // waiting for what to be voted. sheriff, night kill, day kill,
    lastKilled: [], // list of deaths this round
    voteKilled: '', // Who died by vote
    sheriffAlive: true,
    waiting: [], // users waiting for action
    sheriffList: [],
    votes: {}, // username: votes
    ready: false
  })
  game.users.forEach(user => {
    user.role = null
    user.alive = true
    user.poison = true
    user.antidote = true
    user.sheriffRunning = false
    user.sheriff = false
    user.protect = ''
    user.lastProtect = ''
    user.hunterKilled = ''
    user.lastAttacked = ''
    user.revealedIdiot = false
  })
  res.json({ success: true })
  io.to(game.name).emit('restart', null)
}

function assignRoles(game, data) {
  let users = game.users
  let roleArray = []
  for (let _ = 0; _ < data.wolfCount; _++) {
    roleArray.push("wolf")
  }
  if (data.witch) roleArray.push("witch")
  if (data.prophet) roleArray.push("prophet")
  if (data.hunter) roleArray.push("hunter")
  if (data.guard) roleArray.push("guard")
  if (data.idiot) roleArray.push("idiot")
  if (roleArray.length > users.length) {
    return 1
  }
  while (roleArray.length < users.length) {
    roleArray.push("villager")
  }
  shuffle(roleArray)
  for (let i = 0; i < users.length; i++) {
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

function getUsers(game, state) {
  var users = game.users
  var check = ((state === "witchsave") || (state === "witchkill")) ? "witch" : state
  check = ((state === "hunterdeath") || (state === "hunterdeath2")) ? "hunter" : check
  check = ((state === "sheriffdeath") || (state === "sheriffdeath2")) ? "sheriff" : check
  return users.filter((user) => {
    if (check === "killVote" && user.revealedIdiot) return false // Idiot can't vote after revealed
    if (check === "sheriffVote" && !user.sheriffRunning && game.round === 1) return true // Sheriff votes only people who aren't running (MUST BE ROUND 1)
    if (check === "nightStart" || check === "killVote" || check === "dayStart") return true // Everyone participates in these events
    if (check === "sheriffNom" && game.round === 1) return true // Everyone participates in this event on ROUND 1
    if (user.role === "hunter" && check === "hunter" && !user.alive) return true // Check if hunter died
    if (user.role === check) return true // Get by role
    if (check === "sheriff" && user.sheriff && !user.alive) {
      user.sheriff = false
      return true // Check if sheriff died and remove his status
    }
    return false
  })
}

function maxProp(obj) {
  return Object.keys(obj).reduce((a, b) => obj[a] > obj[b] ? a : b)
}

function playGame(game) {
  // Waiting list should be empty when this starts
  let roundList = ['nightStart', 'guard', 'wolf', 'witchsave', 'witchkill',
    'prophet', 'hunter', 'dayStart', 'sheriffNom', 'sheriffVote', 'hunterdeath', 'sheriffdeath', 'killVote', 'hunterdeath2', 'sheriffdeath2']
  if (game.ready) {
    // Deal with votes and move on
    // Unless no votes
    game.sheriffAlive = true
    console.log("Votes: " + JSON.stringify(game.votes))
    if (Object.keys(game.votes).length > 0) {
      var user = findUserInGame(maxProp(game.votes), game.name) // Get max voted
      console.log(game.roundState + ": Voted " + user.name)
      switch (game.roundState) {
        case 'sheriffNom':
          for (u of Object.keys(game.votes)) findUserInGame(u, game.name).sheriffRunning = true
          break
        case 'sheriffVote':
        case 'sheriffdeath':
        case 'sheriffdeath2':
          user.sheriff = true;
          break
        case 'guard':
          getUsers(game, 'guard')[0].protect = user.name
          getUsers(game, 'guard')[0].lastProtect = maxProp(game.votes)
          break;
        case 'wolf':
          if (!(getUsers(game, 'guard')[0] == user.name)) {
            if (user.role === "hunter") user.hunterKilled = true
            if (user.sheriff) game.sheriffAlive = false
            game.lastKilled.push(user.name)
            getUsers(game, "witch")[0].lastAttacked = user.name
            console.log(getUsers(game, "witch"))
          }
          break;
        case 'witchsave':
          if (getUsers(game, 'guard')[0] == user.name) {
            game.lastKilled.push(user.name)
            if (user.sheriff) game.sheriffAlive = false
          } else {
            if (findUserInGame(game.lastKilled.pop(), game.name).sheriff) game.sheriffAlive = true // Revive and check sheriff
          }
          getUsers(game, 'witch')[0].antidote = false
          break;
        case 'hunterdeath':
        case 'hunterdeath2':
        case 'killVote':
          user.alive = false
        case 'witchkill': // this happens before death checking so should be in lastKilled and not directly set
          if (game.roundState == 'witchkill')
            getUsers(game, 'witch')[0].poison = false
          if (user.role === "hunter") user.hunterKilled = true
          if (user.sheriff) game.sheriffAlive = false
          if (game.roundState === 'killVote') {
            if (user.role == "idiot") {
              user.revealedIdiot = true
              user.alive = true
            } else game.voteKilled = user.name
          } else game.lastKilled.push(user.name)
      }
      if (checkEnd(game)) {
        io.to(game.name).emit("gameOver", { winState: checkEnd(game) })
      }
      game.votes = {} // reset votes
    }
    if (game.roundState === "roleCheck")
      game.roundState = "nightStart"
    else {
      let index = roundList.indexOf(game.roundState) == roundList.length - 1 ? 0 : roundList.indexOf(game.roundState) + 1
      if (index == 0) game.round++
      game.roundState = roundList[index]
    }
    game.ready = false
    playGame(game) // Go to next stage
  } else {
    if (game.roundState === "hunterdeath") { // Kill at the beginning of the day before getting users
      for (user of game.lastKilled) {
        findUserInGame(user, game.name).alive = false
      }
    }
    console.log("End: " + checkEnd(game))
    if (checkEnd(game) != 0) {
      io.to(game.name).emit("gameOver", { winState: checkEnd(game) })
    }
    game.waiting = getUsers(game, game.roundState) // Get users for this round
    if (game.waiting.length === 0) { // Nobody needs to go OR its the last hunter round and hunter didn't die
      // Skip this round
      console.log(`skip round ${game.roundState}`)
      let index = roundList.indexOf(game.roundState) == roundList.length - 1 ? 0 : roundList.indexOf(game.roundState) + 1
      if (index == 0) game.round++
      game.roundState = roundList[index]
      game.ready = false
      playGame(game) // Go to next stage
    } else {
      for (user of game.waiting) {
        if (!findUserInGame(user.name, game.name).alive) game.waiting.splice(game.waiting.indexOf(user), 1)
      }  // Remove all people who are not alive
      console.log(game.roundState)
      io.to(game.name).emit("gameState", { state: game.roundState, round: game.round })
    }
  }
}

function checkEnd(game) {
  // 0 = not ended, 1 = wolf win, 2 = wolf loss
  if (game.users.filter((user) => { return user.role == "wolf" && user.alive }).length === 0) return 2
  if (game.rule === "killAll") { // All dead
    if (game.users.filter((user) => { return user.role != "wolf" && user.alive }).length === 0) return 1
  }
  if (game.rule === "killSide") { // All villagers dead or all specials dead
    if (game.users.filter((user) => { return user.role == "villager" && user.alive }).length === 0 ||
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
  switch (game.roundState) {
    case "guard":
      if (user.lastProtect === vote) {
        res.json({ success: false, message: "Protected last round" })
        return
      }
      break
    case "witchsave":
      if (user.lastAttacked === user.name && game.round !== 1) {
        res.json({ success: false, message: "Can't save self" })
        return
      }
      if (user.lastAttacked !== vote) {
        res.json({ success: false, message: "Can't save person not killed by wolves" })
        return
      }
      break
    case "witchkill": // Kill
      if (vote == user.name) {
        res.json({ success: false, message: "Can't poison self" })
        return
      }
      break
  }

  if (!(vote in game.votes)) game.votes[vote] = 0;
  game.votes[vote] += user.sheriff ? 1.5 : 1;
  if (game.roundState === 'prophet') res.json({ success: true, wolf: findUserInGame(vote, req.session.game).role === 'wolf' })
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
  game.waiting = game.waiting.filter(u => { return u.name !== req.session.user })
  if (game.waiting.length == 0) {
    game.ready = true
    playGame(game)
  }
  res.json({ success: true })
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

function getUserInfo(req, res) {
  res.json({ success: true, user: findUserInGame(req.session.user, req.session.game) })
}

app.post('/api/login', login)
app.post('/api/logout', logout)
app.post('/api/join', joinGame)
app.post('/api/leave', leaveGame)
app.post('/api/create', createGame)
app.post('/api/start', startGame)
app.post('/api/restart', restartGame)
app.post('/api/chat', chat)
app.post('/api/vote', vote)
app.get('/api/me', getUserInfo)
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

app.get('/api/whoami', function (req, res) {
  res.json({ username: req.session.user, gamename: req.session.game })
})


var port = 3100
http.listen(port, function () {
  console.log(`listening on *:${port}`);
});
