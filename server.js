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
    socket.emit('sync', settings);
    socket.on('sync', function (data) {
        settings.targetTemp = data.targetTemp;
        settings.threshold = data.threshold;
        settings.killThreshold = data.killThreshold;
    });
    socket.on('reset', function () {
        reset = true;
        killed = false;
    });
    socket.on('disconnect', function () {
        var i = sockets.indexOf(socket);
        if(i > -1) {
            sockets.splice(i, 1);
        }
    });
});

app.get('/', function (req, res) {
    res.render('layout');
});

server.listen(4000, function () {
    
});

var b = require('bonescript');
var inputPin = 'P9_40';
var outputPin = 'P8_13';
var tmp;
var reads = [];
var howMany = 10;

var isHeating = false;
var reset = false;
var killed = false;
var settings = {
    targetTemp: 83,
    threshold: 10,
    killThreshold: 30
};

process.on('uncaughtException', function (err)  {
    console.log('Caught exception:', err);
    b.digitalWrite(outputPin, b.LOW);
});


b.pinMode(outputPin, b.OUTPUT);
b.digitalWrite(outputPin, b.LOW);

function initRead() {
    b.analogRead(inputPin, checkRead);
}
    
function checkRead(x) {
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

    reads.push(temp_f);

    if(reads.length >= howMany) {
        var newTmp = (reads.reduce(function (a, b) {
            return a + b;
        })/reads.length).toFixed(1);

        console.log('newTemp', newTmp);

        if(newTmp !== tmp) {
            tmp = parseFloat(newTmp);
            for(var s in sockets) {
                sockets[s].emit('tmp', {
                    tmp: tmp.toFixed(1),
                    isHeating: isHeating,
                    killed: killed
                });
            }
            checkTarget();
        }
        reads = [];
        console.log(tmp, 'f');
    }
    setTimeout(function () {
        initRead();
    }, 100);
}

initRead();

function checkTarget () {
    console.log('check target', tmp < (settings.targetTemp - settings.threshold), tmp, settings.targetTemp - settings.threshold, typeof tmp, typeof settings.targetTemp, typeof settings.threshold);
    if(killed)
        return;

    if(tmp < (settings.targetTemp - settings.killThreshold)) {
         isHeating = false;
         killed = true;
         b.digitalWrite(outputPin, b.LOW);
     } else if(!isHeating && tmp < (settings.targetTemp - settings.threshold)) {
        console.log('turn fan on');
        isHeating = true;
        b.digitalWrite(outputPin, b.HIGH);
    } else if ((isHeating && tmp >= settings.targetTemp) || (!isHeating)){
        console.log('turn fan off');
        isHeating = false;
        b.digitalWrite(outputPin, b.LOW);
    }
}

