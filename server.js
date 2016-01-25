var express = require('express');
var app = express();
var server = require('http').Server(app);
var io = require('socket.io')(server);
var sockets = [];
app.set('trust proxy', 1); // trust first proxy

app.set('view engine', 'ejs');
app.set('views', __dirname + '/views/');
app.use(express.static(__dirname + '/public'));

io.on('connection', function (socket) {
    sockets.push(socket);
    socket.on('disconnect', function () {
        var i = sockets.indexOf(socket);
        if(i > -1) {
            sockets.splice(i, 1);
        }
    });
});

app.get('/', function (req, res) {
    res.render('layout');
    //res.send(200, '<script src="/socket.io/socket.io.js"></script>' +
        //'<script>' +
         // 'var socket = io.connect();' +
         // 'socket.on(\'connect\',function () {console.log(\'io connected\');});'+
         // 'socket.on(\'tmp\', function (data) {'+
         //   'console.log(data);'+
         // '});'+
       // '</script>'
    //);
});

server.listen(4000, function () {
    
});

var b = require('bonescript');
var inputPin = 'P9_40';
var tmp;
var reads = [];
var howMany = 10;
function initRead () {
    
    
    b.analogRead(inputPin, checkRead);
    
    function checkRead(x) {
        if(!sockets.length) {
            setTimeout(function () {
                initRead();
            }, 100);
            return;
        }
        if(x.err) {
            console.log(x.err);
            setTimeout(function () {
                initRead();
            }, 100);
            return;
        }
        var millivolts = x.value * 1800;  // 1.8V reference = 1800 mV
        var temp_c = (millivolts - 500) / 10;
        var temp_f = (temp_c * 9/5) + 32;
        console.log('read', temp_f);
        reads.push(temp_f);
        if(reads.length >= howMany) {
            var newTmp = (reads.reduce(function (a, b) {
                return a + b;
            })/reads.length).toFixed(1);
            console.log('newTemp', newTmp);
            if(newTmp !== tmp) {
                tmp = newTmp;
                for(var s in sockets) {
                    sockets[s].emit('tmp', tmp);
                }
            }
            reads = [];
            console.log(tmp, 'f');
        }
        setTimeout(function () {
            initRead();
        }, 100);
    }
}
console.log(__dirname);

initRead();

