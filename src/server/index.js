var app = require('express')();
var http = require('http').createServer(app);
var io = require('socket.io')(http);
var session = require('express-session')
var sharedsession = require("express-socket.io-session");

var games = {} // each game is a namespaces. a game has a users list
var socketGameUserMap = {} // socket.id => {game, user}

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



function newGame(gamename, username, socket) {
  if (games[gamename]) {
    throw new Error(`Game name ${gamename} is taken`)
  }
  games[gamename] = {
    name: gamename,
    status: 'waiting',
    users: {} // username => user
  }
  userJoinGame(username, gamename, socket)
}

function delGame(gamename) {
  let game = findGame(gamename)
  delete (game)
}

function userJoinGame(username, gamename, socket) {
  if (!socket) {
    throw new Error(`socket is not provided.`)
  }
  let game = findGame(gamename)
  if (game.status != 'waiting') {
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
    isOrganizer: isOrganizer
  }

  socket.join(game.name)
  socketGameUserMap[socket.id] = { game: game.name, user: username }

  let message = `${username} joined game ${gamename}`
  console.log(message)
  io.to(game.name).emit('message', { type: 'info', message: message })
  io.to(game.name).emit('refresh', null)
}

function userLeaveGame(username, gamename) {
  let game = findGame(gamename)
  if (game.users[username]) {
    let message = `${username} left game ${gamename}`
    console.log(message)
    io.to(game.name).emit('message', { type: 'info', message: message })
    io.to(game.name).emit('refresh', null)
  }
}

function getGameDetails(gamename) {
  let game = findGame(gamename)
  return {
    name: game.name,
    status: game.status,
    users: Object.values(game.users).map(u => {
      return { name: u.name, isOrganizer: u.isOrganizer }
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

  socket.on('join', function (info) {
    console.log(info)
    try {
      userJoinGame(info.user, info.game, socket)
    } catch (error) {
      socket.emit('message', { type: 'error', message: error.message })
      return
    }
  })

  socket.on('new', function (info) {
    console.log(info)
    try {
      newGame(info.game, info.user, socket)
    } catch (error) {
      socket.emit('message', { type: 'error', message: error.message })
      return
    }
  })

  socket.on('chat', function (chat) {
    console.log(`got chat ${chat.message} from ${socket.id}`)
    console.log(socketGameUserMap)

    if (!socketGameUserMap[socket.id]) return

    let { user, game } = socketGameUserMap[socket.id]
    console.log(`${user} send to ${game}`)
    let from = user
    let room = game
    io.to(room).emit('chat', { from: from, message: chat.message })
  })

  socket.on('disconnect', function () {
    console.log('user disconnected');
    delete socketGameUserMap[socket.id]
  })

});


app.get('/api/game/:gamename/:username', function (req, res) {
  let gamename = req.params.gamename
  let username = req.params.username

  req.session.game = gamename
  req.session.user = username

  console.log(`get game ${gamename}`)
  try {
    let game = getGameDetails(gamename)
    res.json(game)
  } catch (error) {
    res.status(400).json({ message: error.message })
  }
})

app.get('/api/testsession', function (req, res) {
  if (req.session.test) {
    req.session.test++
    res.json({ test: req.session.test })
  } else {
    req.session.test = 1
    res.json({ message: 'set test to 1' })
  }
})

app.get('/api/me', function (req, res) {
  console.log('me is called')
  console.log(` game: ${req.session.game}, user: ${req.session.user}`)
  res.json({ username: req.session.user, gamename: req.session.game })
})


var port = 3100
http.listen(port, function () {
  console.log(`listening on *:${port}`);
});