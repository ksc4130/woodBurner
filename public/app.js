(function () {
    var app = angular.module('app', []);
    
    app.factory('socket', function ($rootScope) {
      var socket = io.connect();
      return {
        on: function (eventName, callback) {
          socket.on(eventName, function () {  
            var args = arguments;
            $rootScope.$apply(function () {
              callback.apply(socket, args);
            });
          });
        },
        emit: function (eventName, data, callback) {
          socket.emit(eventName, data, function () {
            var args = arguments;
            $rootScope.$apply(function () {
              if (callback) {
                callback.apply(socket, args);
              }
            });
          })
        }
      };
    });
    
    app.factory('mainSrv', ['socket', function (socket) {
        var self = {
            vals: {
                tmp: 0,
                color: 'purple',
                max: 212,
                isHeating: false,
                killed: true
            },
            settings: {
                targetTemp: null,
                threshold: null,
                killThreshold: null,
                updateKey: null
            }
        };
        socket.on('tmp', function (t) {
            console.log('tmp', t);
            self.vals.tmp = t.tmp;
            self.vals.isHeating = t.isHeating;
            self.vals.max = self.max || parseInt(t) + 50;
            self.vals.killed = t.killed;
            if(t > 74) {
              self.vals.color = 'red';
            } else if(t < 73) {
              self.vals.color = 'blue';
            } else {
              self.vals.color = 'purple';
            }
        });

        socket.on('sync', function (data) {
            self.settings.targetTemp = data.targetTemp;
            self.settings.threshold = data.threshold;
            self.settings.killThreshold = data.killThreshold;
        });

        self.sendSync = function () {
            socket.emit('sync', self.settings);
        };

        self.reset = function (updateKey) {
            socket.emit('reset', {updateKey: self.settings.updateKey});
        };

        self.kill = function (updateKey) {
            socket.emit('kill', {updateKey: self.settings.updateKey});
        };

        return self;
    }]);
    
    app.controller('mainCtrl', ['$scope', 'mainSrv', function ($scope, mainSrv) {
        $scope.copyright = new Date();
        $scope.vals = mainSrv.vals;
        $scope.settings = mainSrv.settings;
        $scope.reset = mainSrv.reset;
        $scope.sendSync = function () {
           mainSrv.sendSync();
           $scope.turnedAround = false;
        };
        $scope.needle = function () {
          return 360 - ($scope.vals.tmp / 360);
        };
        $scope.kill = mainSrv.kill;
    }]);
}());
