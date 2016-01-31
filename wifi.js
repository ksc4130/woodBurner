var exec = require('child_process').exec;

var http = require('http');
var networks = [];
var isConnected = false;
var curNetwork;

var server = http.createServer(function(req, res) {
    var ns = networks ? JSON.stringify(networks)  : 'no networks';
    var n = curNetwork ? JSON.stringify(curNetwork) : 'not connected';
    res.end(ns + '<br><br>' + n);
});

server.listen(4001);

var cmds = {
    scan: 'sudo iwlist :INTERFACE scan',
    stat: 'sudo iwconfig :INTERFACE',
    disable: 'sudo ifconfig :INTERFACE down',
    enable: 'sudo ifconfig :INTERFACE up',
    interfaces: 'sudo iwconfig',
    dhcp: 'sudo dhcpcd :INTERFACE',
    dhcp_disable: 'sudo dhcpcd :INTERFACE -k',
    leave: 'sudo iwconfig :INTERFACE essid ""',

    metric: 'sudo ifconfig :INTERFACE metric :METRIC',
    connect_wep: 'sudo iwconfig :INTERFACE essid ":ESSID" key :PASSWORD',
    connect_wpa: "sudo wpa_passphrase ':ESSID' ':PASSWORD' > wpa-temp.conf && sudo wpa_supplicant -D wext -i :INTERFACE -c wpa-temp.conf && rm wpa-temp.conf",
    connect_open: 'sudo iwconfig :INTERFACE essid ":ESSID"',
};

exec('sudo iwlist wlan0 scan', function(err, stdout, stderr) {
    networks = parseScan(stdout.toString());
});

checkConnected();

function checkConnected () {
    exec('sudo iwconfig wlan0', function(err, stdout, stderr) {
        if (err) {
            self.emit('error', "Error getting wireless devices information");
            // TODO: Destroy
            return;
        }

        var content = stdout.toString();
        var lines = content.split(/\r\n|\r|\n/);
        var foundOutWereConnected = false;
        var networkAddress = null;

        lines.forEach(function(line) {

            if (line.indexOf('Access Point') !== -1) {
                networkAddress = line.match(/Access Point: ([a-fA-F0-9:]*)/)[1] || null;

                if (networkAddress) {
                    foundOutWereConnected = true;
                }
            }
        });

        if (foundOutWereConnected) {
            isConnected = true;

            var network = networks.filter(function (item) {
                return item.address === networkAddress;
            })[0];

            if (network) {
                curNetwork = network;
                //return;
            }
        } else {
            isConnected = false;
            curNetwork = null;
        }
        
        if(!isConnected) {
            console.log('*********not connected');
            exec('ifdown wlan0', function (err, stdout, stderr) {
                console.log('down', stdout.toString());
                exec('ifup wlan0', function (err, stdout, stderr) {
                    console.log('up', stdout.toString());
                    setTimeout(function () {
                        console.log('checking after not connected');
                        checkConnected();
                    }, 10000);
                })
            });
        } else {
            console.log('connected', network);
            setTimeout(function () {
                checkConnected();
            }, 5000);
        }
    });
}

function parseScan (scanResults) {
    var lines = scanResults.split(/\r\n|\r|\n/);
    var networkCount = 0;
    var network = null;
    
    lines.forEach(function(line) {
        line = line.replace(/^\s+|\s+$/g,"");
        
        // a "Cell" line means that we've found a start of a new network
        if (line.indexOf('Cell') === 0) {
            console.log('cell', line);
            networkCount++;

            if(network) {
                networks.push(network);
            }

            network = {
                //speeds: []
                last_tick: 0,
                encryption_any: false,
                encryption_wep: false,
                encryption_wpa: false,
                encryption_wpa2: false,
            };

            network.address = line.match(/([0-9a-fA-F]{2}:){5}[0-9a-fA-F]{2}/)[0];
        } else if (line.indexOf('Channel') === 0) {
            network.channel = line.match(/Channel:([0-9]{1,2})/)[1];
        } else if (line.indexOf('Quality') === 0) {
            // observed versions of this line:
            //   Quality=100/100  Signal level=47/100
            //   Quality:23  Signal level:0  Noise level:0
            var qMatch = line.match(/Quality(:|=)(\d+)[^\d]/),
                sMatch = line.match(/Signal level(:|=)(-?\d+)[^\d]/);
            if (qMatch && qMatch.length >= 3) {
                network.quality = parseInt(qMatch[2], 10);
            }
            if (sMatch && sMatch.length >= 3) {
                network.strength = parseInt(sMatch[2], 10);
            }
        } else if (line.indexOf('Encryption key') === 0) {
            var enc = line.match(/Encryption key:(on|off)/)[1];
            if (enc === 'on') {
                network.encryption_any = true;
                network.encryption_wep = true;
            }
        } else if (line.indexOf('ESSID') === 0) {
            console.log('essid', line.match(/ESSID:"(.*)"/)[1], network);
            network.ssid = line.match(/ESSID:"(.*)"/)[1];
        } else if (line.indexOf('Mode') === 0) {
            network.mode = line.match(/Mode:(.*)/)[1];
        } else if (line.indexOf('IE: IEEE 802.11i/WPA2 Version 1') === 0) {
            network.encryption_wep = false;
            network.encryption_wpa2 = true;
        } else if (line.indexOf('IE: WPA Version 1') === 0) {
            network.encryption_wep = false;
            network.encryption_wpa = true;
        }
        
        return network;
    });

    return networks;
}

