console.log('starting server');
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
        console.log('got sync', data);
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
    socket.on('config.settings.reset', function (data) {
        console.log('got config.settings.reset', data);
        if(data.updateKey === config.updateKey) {
            config.settings.reset = true;
            config.settings.killed = false;
        }
    });
    socket.on('kill', function (data) {
        console.log('got kill', data);
        if(data.updateKey === config.updateKey) {
            config.settings.killed = true;
            config.settings.reset = false;
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
    console.log('server listening on port 4000');
});

var b = require('bonescript');
var inputPin = 'P9_40';
var outputPin = 'P8_13';
var btnToggleFan = 'P8_14';
var tmp;
var reads = [];
var howMany = 10;

var isHeating = false;
config.settings.reset = config.settings.reset || false;
config.settings.killed = config.settings.killed || false;

process.on('uncaughtException', function (err)  {
    console.log('Caught exception:', err);
    b.digitalWrite(outputPin, b.LOW);
});


b.pinMode(outputPin, b.OUTPUT);
b.pinMode(btnToggleFan, b.INPUT);
b.digitalWrite(outputPin, b.LOW);

function checkButton(x) {
    if(x.value == 1){
        //do work
        config.settings.reset = !config.settings.reset;
        config.settings.killed = !config.settings.killed;
        setTimeout(function () {
            b.digitalRead(btnToggleFan, checkButton);
        }, 100);
    }
    else{
        setTimeout(function () {
            b.digitalRead(btnToggleFan, checkButton);
        }, 20);
    }
}

b.digitalRead(btnToggleFan, checkButton);

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
                killed: config.settings.killed
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
    if(config.settings.killed)
        return;

    if(!config.settings.reset && tmp < (config.settings.targetTemp - config.settings.killThreshold)) {
         if(config.settings.killed && !isHeating)
            return;
         console.log('kill', tmp);
         isHeating = false;
         config.settings.killed = true;
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
        config.settings.reset = false;
        b.digitalWrite(outputPin, b.LOW);
    }
}

