var fs = require('fs');
var configFilePath = './config.json';
var config = JSON.parse(fs.readFileSync(configFilePath));

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
    //sockets.push(socket);
    
    socket.emit('sync', config.settings);
    
    socket.on('sync', function (data) {
        if(data.updateKey === config.updateKey) {
            config.settings.targetTemp = data.targetTemp;
            config.settings.threshold = data.threshold;
            config.settings.killThreshold = data.killThreshold;
            
            io.emit('sync', config.settings);
            
            delete data.updateKey;
            
            fs.writeFile(configFilePath, JSON.stringify(config), function (err) {
                console.log('updated config file', err);
            });
        } else {
           socket.emit('sync', config.settings); 
        }
    });
    socket.on('reset', function (data) {
        if(data.updateKey === config.updateKey) {
            reset = true;
            killed = false;
        }
    });
    socket.on('kill', function (data) {
        if(data.updateKey === config.updateKey) {
            killed = true;
            reset = false;
            b.digitalWrite(outputPin, b.LOW);
            isHeating = false;
        }
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

    if(reads.length >= howMany + 2) {
        reads.sort(function (a, b) {
          if (a < b) {
            return -1;
          }
          if (a > b) {
            return 1;
          }
          
          return 0;
        });
        //drop lowest and highest read
        reads = reads.splice(1, reads.length - 2);
        
        var newTmp = (reads.reduce(function (a, b) {
            return a + b;
        })/reads.length).toFixed(1);

        if(newTmp !== tmp) {
            tmp = parseFloat(newTmp);
            io.emit('tmp', {
                tmp: tmp.toFixed(1),
                isHeating: isHeating,
                killed: killed
            });
            
            checkTarget();
        }
        reads = [];
    }
    setTimeout(function () {
        initRead();
    }, 100);
}

initRead();

function checkTarget () {
    if(killed)
        return;

    if(!reset && tmp < (config.settings.targetTemp - config.settings.killThreshold)) {
         if(killed && !isHeating)
            return;
         console.log('kill', tmp)
         isHeating = false;
         killed = true;
         b.digitalWrite(outputPin, b.LOW);
     } else if(!isHeating && tmp < (config.settings.targetTemp - config.settings.threshold)) {
        if(isHeating)
            return;
        console.log('turn fan on', tmp);
        isHeating = true;
        b.digitalWrite(outputPin, b.HIGH);
    } else if ((isHeating && tmp >= config.settings.targetTemp) || (!isHeating)){
        if(!isHeating)
            return;
        console.log('turn fan off', tmp);
        isHeating = false;
        reset = false;
        b.digitalWrite(outputPin, b.LOW);
    }
}

