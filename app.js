var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');

var routes = require('./routes/index');
var users = require('./routes/users');

var app = express();

//new added code
var server = require('http').createServer(app);
var io = require('socket.io').listen(server);

app.set('port', process.env.PORT || 80);
// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'html');

//database
var sqlite3 = require('sqlite3').verbose();
var db = new sqlite3.Database("chatroom.db");

db.serialize(function(){
	db.run('CREATE TABLE IF NOT EXISTS userlist (name TEXT PRIMARY KEY, leftTime TEXT)');
	db.run('CREATE TABLE IF NOT EXISTS msglist (name TEXT, time TEXT PRIMARY KEY, msg TEXT)');	
});

// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', routes);
app.use('/users', users);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
  app.use(function(err, req, res, next) {
    res.status(err.status || 500);
    res.render('error', {
      message: err.message,
      error: err
    });
  });
}

// production error handler
// no stacktraces leaked to user
app.use(function(err, req, res, next) {	
  res.status(err.status || 500);
  res.write(err.message);
  res.end();
});


io.on('connection', function (socket) {
  socket.emit('newconnection');

  var name = ' ';

  socket.on('person', function(person){

	name = person;
	db.all('SELECT COUNT(name) AS namesCount FROM userlist WHERE name = ?', person, function(err, rows){
		if(rows[0].namesCount == 0){
	    	db.run('INSERT INTO userlist VALUES(?, ?)', person, '99:99:99');

	    	var msgobject = {time:getTime()};
	    	msgobject['sender'] = 'System';
	    	msgobject['msgtype'] = 'welcome';
	    	msgobject['text'] = name;
	    	socket.emit('systemmsg', msgobject);
	    	socket.broadcast.emit('systemmsg', msgobject);
		}else{
		    db.each('SELECT * FROM userlist WHERE name = ?', person, function(err, row){
			var name = row.name;
			var leftTime = row.leftTime;
			db.each('SELECT * FROM msglist', function(err, row){
				if(row.time > leftTime){
					var msgobject = {sender: row.name, time: row.time, text: row.msg, msgtype: 'message'};
					socket.emit('message', msgobject);
				}
			});
		    });
		}
	});
  });
  
  socket.on('message', function(msg){
	var msgobject = {time: getTime()};
	msgobject['text'] = msg;
	msgobject['sender'] = name;
	msgobject['msgtype'] = 'message';
    
	socket.emit('message', msgobject);
    socket.broadcast.emit('message',msgobject);
    
    db.run('INSERT INTO msglist VALUES(?, ?, ?)', msgobject['sender'], msgobject['time'], msgobject['text']);
    });
  
    socket.on('disconnect', function () {  
    	var msgobject = {
    			time: getTime(),
    			sender: 'System',
    			text: name,
    			msgtype: 'disconnect'
    	};
      if(name.length > 0){
          socket.broadcast.emit('systemmsg', msgobject);               
          db.run("UPDATE userlist SET leftTime = ? WHERE name = ?", getTime(), name);
      }     
    });

});

server.listen(app.get('port'), function(){
	});

var getTime = function(){
	  var date = new Date();
	  return date.getHours()+":"+date.getMinutes()+":"+date.getSeconds();
	};
	
//db.close();

module.exports = app;
