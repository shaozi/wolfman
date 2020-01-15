var app = require('express')();
//var cors = require('cors')
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
  console.log(`${socket.handshake.session.game}: ${socket.handshake.session.user} socket connected`)
  try {
    let username = socket.handshake.session.user
    let gamename = socket.handshake.session.game
    if (username && gamename) {
      let game = findGame(gamename)
      let user = findUserInGameByName(username, gamename)
      console.log(`${user.name} relogged in ${game.name}`)
      socket.join(game.name)
      socketGameUserMap[socket.id] = { game: game.name, user: user.name }
      console.log(`${username} socket connected, send refresh signal`)
      socket.emit('refresh', null)
    }
  } catch (error) {
    console.log(error.message)
  }

  socket.on('disconnect', function () {
    if (!socketGameUserMap[socket.id]) {
      return
    }
    let { game, user } = socketGameUserMap[socket.id]
    console.log(`${game}: ${user} socket disconnected`);
    delete socketGameUserMap[socket.id]
  })

})


function deleteGame(req, res) {
  var gamename = req.session.game
  if (findGame(gamename)) {
    delete games[gamename]
  }
  io.to(gamename).emit('message', { type: 'warning', message: `Last user left. ${gamename} deleted` })
  io.to(gamename).emit('refresh', null)
  res.json({ success: true })
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
  let avatar = `/assets/avatar/kidaha-${Math.floor(Math.random() * 12) + 1}`
  game.users.push({
    name: username,
    avatar: avatar,
    role: null,
    alive: true,
    poison: true,
    antidote: true,
    sheriffRunning: false,
    quitSheriffRunning: false,
    sheriff: false,
    protect: '',
    lastProtect: '',
    hunterCanShoot: false,
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
  // don't leak more information here
  let game = findGame(gamename)
  if (!game) {
    console.log(`getGameDetails ${gamename} does not exist`)
    return {}
  }
  return {
    name: game.name,
    users: game.users.map(u => {
      return {
        name: u.name,
        avatar: u.avatar,
        isOrganizer: u.isOrganizer,
        alive: u.alive,
        sheriffRunning: u.sheriffRunning,
        quitSheriffRunning: u.quitSheriffRunning,
        sheriff: u.sheriff,
        revealedIdiot: u.revealedIdiot
      }
    }),
    round: game.round,
    roundState: game.roundState,
    options: game.options
  }
}

function findGame(gamename) {
  let game = games[gamename]
  if (!game) {
    console.error(`findGame ${gamename} does not exist`)
    return {}
  }
  return game
}

function findUserInGameByName(username, gamename) {
  let game = findGame(gamename)
  let user = game.users.find(u => { return u.name == username })
  if (!user) {
    console.error(`${username} is not in ${gamename}`)
    return {}
  }
  return user
}

function findUserInGameByRole(game, role) {
  return game.users.find(u => { return u.role === role })
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
    delete games[gamename]
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
    //console.log(JSON.stringify(games[gamename], null, 2))
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
  //console.log(JSON.stringify(game, null, 2))
}

function restartGame(req, res) {
  let game = findGame(req.session.game)
  Object.assign(game, {
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
    user.lastAttacked = ''
    user.hunterCanShoot = false
    user.revealedIdiot = false
  })
  res.json({ success: true })
  io.to(game.name).emit('restart', null)
  //console.log(JSON.stringify(game, null, 2))
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
  check = ((state === "hunterKill") || (state === "hunterKill2")) ? "hunterKill" : check
  check = ((state === "sheriffdeath") || (state === "sheriffdeath2")) ? "sheriff" : check
  return users.filter((user) => {
    switch (check) {
      case 'killVote':
        return (user.alive && !user.revealedIdiot) // Idiot can't vote after revealed
      case 'sheriffVote':
        return (game.round === 1 && !user.sheriffRunning) // Sheriff votes only people who aren't running (MUST BE ROUND 1)
      case 'nightStart':
        return user.alive
      case 'dayStart':
        return true // Everyone participates in these events
      case 'sheriffNom':
        return game.round === 1 // Everyone participates in this event on ROUND 1
      case 'hunter':
        return user.role === 'hunter'
      case 'hunterKill':
        return user.role === 'hunter' && user.hunterCanShoot // Check if hunter died
      case 'sheriff':
        return (user.sheriff && !user.alive)
      case 'wolf':
        return user.role === 'wolf' && user.alive
      default:
        return (user.role === check && user.alive)
    }

    if (check === "killVote" && (user.revealedIdiot || !user.alive)) return false
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

  if (game.ready) {
    // Deal with votes and move on
    // Unless no votes
    game.sheriffAlive = true
    console.log("Votes: " + JSON.stringify(game.votes))
    if (Object.keys(game.votes).length > 0) {
      var user = findUserInGameByName(maxProp(game.votes), game.name) // Get max voted
      console.log(game.roundState + ": Voted " + user.name)
      switch (game.roundState) {
        case 'sheriffNom':
          for (u in game.votes) findUserInGameByName(u, game.name).sheriffRunning = true
          break
        case 'sheriffVote':
        case 'sheriffdeath':
        case 'sheriffdeath2':
          game.users.forEach(u => {
            u.sheriff = false
            u.sheriffRunning = false
          })
          user.sheriff = true
          //console.log('sheriff is voted: ', user)
          break
        case 'guard': {
          let guard = game.users.filter(u => { return u.role === 'guard' })
          if (guard && !guard.alive) break
          guard.protect = user.name
          guard.lastProtect = maxProp(game.votes)
          break
        }
        case 'wolf': {
          let guard = findUserInGameByRole(game, 'guard')
          if (guard && guard.protect == user.name) break

          if (user.role === "hunter") user.hunterCanShoot = true
          if (user.sheriff) game.sheriffAlive = false
          game.lastKilled.push(user.name)
          let witch = findUserInGameByRole(game, 'witch')
          if (witch) {
            // witch will not know who is attacked if antidote is used
            if (witch.antidote) {
              witch.lastAttacked = user.name
            } else {
              witch.lastAttacked = ''
            }
          }
          break;
        }
        case 'witchsave': {
          let witch = findUserInGameByRole(game, 'witch')
          if (!witch || !witch.alive || !witch.antidote) break // skip if witch is dead or no antidote
          console.log('witchsave is active')
          let guard = findUserInGameByRole(game, 'guard')
          if (guard && guard.protect == user.name) { // witch save and guard protect -> die
            game.lastKilled.push(user.name)
            if (user.sheriff) game.sheriffAlive = false
          } else {
            let savedUserName = game.lastKilled.pop()
            let savedUser = findUserInGameByName(savedUserName, game.name)
            if (savedUser.role == 'hunter') {
              savedUser.hunterCanShoot = false
            }
            if (savedUser.sheriff) {
              game.sheriffAlive = true // Revive and check sheriff
            }
          }
          witch.antidote = false
          break;
        }
        case 'hunterKill':
        case 'hunterKill2': {
          user.alive = false
          let hunter = findUserInGameByRole(game, 'hunter')
          if (hunter) {
            hunter.hunterCanShoot = false
          }
          break
        }
        case 'killVote':
          user.alive = false
          if (user.role === 'hunter') {
            user.hunterCanShoot = true
          }
          if (user.role == "idiot") {
            user.revealedIdiot = true
            user.alive = true
          } else {
            game.voteKilled = user.name
          }
          break
        case 'witchkill': // this happens before death checking so should be in lastKilled and not directly set
          {
            let witch = findUserInGameByRole(game, 'witch')
            if (!witch || !witch.alive || !witch.poison) break
            // skip if witch is dead or does not have poision
            // user.alive = false
            console.log('witchkill is active')
            witch.poison = false
            if (user.role === "hunter") user.hunterCanShoot = false // witch poisoned hunter, hunter cannot revenge
            if (user.sheriff) game.sheriffAlive = false
            game.lastKilled.push(user.name)
            break
          }
      }
      checkEnd(game)
      game.votes = {} // reset votes
    }
    if (game.roundState === "roleCheck")
      game.roundState = "nightStart"
    else
      advanceRound(game)
    game.ready = false
    playGame(game) // Go to next stage
  } else {
    if (game.roundState === "hunterKill") { // Kill at the beginning of the day before getting users
      for (user of game.lastKilled) {
        findUserInGameByName(user, game.name).alive = false
      }
    }
    let endResult = checkEnd(game)
    //console.log(`End: ${endResult}`)
    game.waiting = getUsers(game, game.roundState) // Get users for this round
    if (game.waiting.length === 0) { // Nobody needs to go OR its the last hunter round and hunter didn't die
      // Skip this round
      console.log(`skip round ${game.roundState}`)
      advanceRound(game)
      game.ready = false
      playGame(game) // Go to next stage
    } else {
      //for (user of game.waiting) {
      //if (!findUserInGame(user.name, game.name).alive) game.waiting.splice(game.waiting.indexOf(user), 1)
      //}  // Remove all people who are not alive
      console.log(game.roundState, game.waiting.map(u => { return u.name }))
      io.to(game.name).emit("gameState", { state: game.roundState, round: game.round })
    }
  }
}

function advanceRound(game, wolfSuicide=false) {
  let roundList = [
    'nightStart',
    'guard',
    'wolf',
    'witchsave',
    'witchkill',
    'prophet',
    'hunter',
    'dayStart',
    'sheriffNom',
    'sheriffVote',
    'hunterKill',
    'sheriffdeath',
    'killVote',
    'hunterKill2',
    'sheriffdeath2'
  ]
  if (wolfSuicide) {
    game.round++
    game.roundState = 'nightStart'
    console.log(`Wolf Suicide, Game round advanced to round: ${game.round}, state: ${game.roundState}`)
    return
  }
  let index = roundList.indexOf(game.roundState) == roundList.length - 1 ? 0 : roundList.indexOf(game.roundState) + 1
  if (index == 0) game.round++
  game.roundState = roundList[index]
  console.log(`Game round advanced to round: ${game.round}, state: ${game.roundState}`)
}

function checkEnd(game) {
  // 0 = not ended, 1 = wolf win, 2 = wolf loss
  let result = 0
  let wolfCount = game.users.filter((user) => { return user.role == "wolf" && user.alive }).length
  let nonWolfCount = game.users.filter((user) => { return user.role != "wolf" && user.alive }).length
  let villagerCount = game.users.filter((user) => { return user.role == "villager" && user.alive }).length
  let specialCharactorCount = game.users.filter((user) => { return user.role != "wolf" && user.role != "villager" && user.alive }).length

  if (wolfCount === 0) {
    result = 2
  } else if (game.options.gameType === "killAll") { // All dead
    if (nonWolfCount === 0) {
      result = 1
    }
  } else if (game.options.gameType === 'killSide') { // All villagers dead or all specials dead
    if (villagerCount === 0 || specialCharactorCount === 0) {
      result = 1
    }
  }
  if (result) {
    io.to(game.name).emit('gameOver', { winState: result })
    game.round = 0
    game.over = true
  }
  return result
}

/**
 * Sets vote and checks validity and sends wolfness if prophet
 */
function vote(req, res) {
  var game = findGame(req.session.game)
  var { state, vote } = req.body
  var user = findUserInGameByName(req.session.user, req.session.game)
  console.log(`${req.session.user} in ${req.session.game} vote ${JSON.stringify(vote)}`)
  if (state !== game.roundState) {
    console.log(`${req.session.user} in ${req.session.game} send vote state : ${state} != game state : ${game.roundState}. ignore vote`)
    res.json({success: false, message: 'Wrong game state'})
    return
  }
  // Check Validity based on round
  if (!vote) {
    console.log('vote is false')
    res.json({success: false, message: 'Vote invalid'})
    return
  }
  switch (game.roundState) {
    case "guard":
      if (user.lastProtect === vote) {
        res.json({ success: false, message: "Protected last round" })
        return
      }
      break
    case "witchsave":
      if (!user.alive) {
        // witch is dead
        console.log('witch is dead cannot use antidote')
        break
      }
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
      if (!user.alive) {
        // witch is dead
        console.log('witch is dead cannot use poision')
        break
      }
      if (vote === user.name) {
        res.json({ success: false, message: "Can't poison self" })
        return
      }
      break
  }

  if (!(vote in game.votes)) game.votes[vote] = 0;
  game.votes[vote] += user.sheriff ? 1.5 : 1;
  if (game.roundState === 'prophet' && user.role === 'prophet') {
    if (user.alive) {
      res.json({ success: true, wolf: findUserInGameByName(vote, req.session.game).role === 'wolf' })
    } else {
      res.json({ success: false, message: 'no power' })
    }
  } else {
    res.json({ success: true })
  }
}

/** Removes user from waiting list and runs next section if waiting for nobody
 */
function ready(req, res) {
  var info = req.body
  var user = req.session.user
  console.log(`READY: user : ${user}, info: ${JSON.stringify(info)} `)
  var game = findGame(req.session.game)
  if (info.state !== game.roundState) {
    console.log(`${req.session.user} in ${req.session.game} send ready state : ${info.state} != game state : ${game.roundState}. ignore vote`)
    res.json({success: false, message: 'wrong ready state'})
    return
  }
  game.waiting = game.waiting.filter(u => { return u.name !== req.session.user })
  console.log(JSON.stringify(game.waiting.map(u => { return u.name })))
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
  res.json({ success: true, user: findUserInGameByName(req.session.user, req.session.game) })
}

app.post('/api/login', login)
app.post('/api/logout', logout)
app.post('/api/join', joinGame)
app.post('/api/leave', leaveGame)
app.post('/api/create', createGame)
app.post('/api/start', startGame)
app.post('/api/restart', restartGame)
app.delete('/api/delete', deleteGame)
app.post('/api/chat', chat)
app.post('/api/vote', vote)
app.get('/api/me', getUserInfo)
app.post('/api/ready', ready)
app.get('/api/game', function (req, res) {
  let gamename = req.session.game
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
