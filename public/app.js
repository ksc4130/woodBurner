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
                tmp: null,
                color: 'purple',
                max: null,
                isHeating: null,
                killed: null
            },
            settings: {
                targetTemp: null,
                threshold: null,
                killThreshold: null
            }
        };
        socket.on('tmp', function (t) {
           console.log('tmp', t);
          self.vals.tmp = t.tmp;
          self.vals.isHeating = t.isHeating;
          self.vals.max = self.max || parseInt(t) + 50;
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

        self.reset = function () {
            socket.emit('reset');
        };

        return self;
    }]);
    
    app.controller('mainCtrl', ['$scope', 'mainSrv', function ($scope, mainSrv) {
        $scope.vals = mainSrv.vals;
        $scope.settings = mainSrv.settings;
        $scope.reset = mainSrv.reset;
        $scope.sendSync = mainSrv.sendSync;
    }]);
}());

//app.directive('canvasGauge', function () {
//    return {
//        restrict: 'E',
//        replace: true,
//        template:  '<canvas></canvas>',
//        scope: { val: '=value' },
//        link: function($scope, element, attrs) {
//
//            var width = parseInt(attrs.width || '100');
//            $scope.height = width * 0.55;
//            element.attr('height', $scope.height + 'px');
//
//            var placeholder = attrs.placeholder || '(@)';
//            var mask = attrs.mask || placeholder;
//            var canvas = element[0];
//
//            var animID = 0;
//            var curValue = 0;
//            var endValue = 0;
//            var oldValue = 0;
//            var direction = 0;
//
//            var render = function(val) {
//
//                var value = val || 0;
//
//                if (canvas.getContext) {
//                    var ctx = canvas.getContext('2d');
//                    ctx.clearRect (0, 0, canvas.width, canvas.height);
//
//                    var calcPercent = function(total, perc) { return (total * perc) / 100; }
//
//                    var per            = ((value - $scope.min) * 100) / ($scope.max - $scope.min);      // Value converted to percentage using min and max
//                    var pad            = calcPercent(canvas.width, 15);                                 // Inner padding around the container
//                    var x              = canvas.width / 2;                                              // x coordinate
//                    var y              = (canvas.width / 2.3);                                          // y coordinate
//                    var startAngle     = 0;                                                             // Starting point on circle
//                    var radius         = x - pad;                                                       // Circle's radius
//                    var lineWidth      = (canvas.width / 8);                                            // Thickness of the drawing tip
//                    var fontSize       = (canvas.width * 0.1);                                          // Default size of the text font (10% of canvas width)
//
//                    ctx.imageSmoothingEnabled = true;
//                    ctx.shadowOffsetX = 0;
//                    ctx.shadowOffsetY = 0;
//                    ctx.shadowBlur = 0;
//
//                    ctx.beginPath();
//                    ctx.arc(x, y, radius, Math.PI, Math.PI * 2, false);
//                    ctx.lineWidth = lineWidth;
//                    ctx.strokeStyle = $scope.underColor;
//                    ctx.stroke();
//                    ctx.closePath();
//
//                    var endAngle = ((Math.PI * per) / 100) + Math.PI;
//                    ctx.beginPath();
//                    ctx.arc(x, y, radius, Math.PI, endAngle, false);
//                    ctx.lineWidth = lineWidth;
//                    ctx.strokeStyle = $scope.overColor;
//                    ctx.stroke();
//                    ctx.closePath();
//
//                    ctx.font = 'bold ' + fontSize + 'pt Calibri';
//                    ctx.textAlign = 'center';
//                    ctx.fillStyle = $scope.textColor;
//                    ctx.shadowColor = $scope.shadeColors($scope.smallTextColor, -30);
//                    ctx.shadowOffsetX = 1;
//                    ctx.shadowOffsetY = 1;
//                    ctx.shadowBlur = 0;
//                    ctx.fillText(mask.replace(placeholder, parseFloat(value.toFixed(2)).toString()), x, y);
//
//                    if (canvas.width > 119) {
//                        y = (canvas.width / 2.2) + calcPercent(canvas.height, 10) + (canvas.width / 100) - 1;
//                        x = pad;
//                        ctx.font = 'normal ' + (fontSize / 2) + 'pt Calibri';
//                        ctx.shadowOffsetX = 0;
//                        ctx.shadowOffsetY = 0;
//                        ctx.fillStyle = $scope.smallTextColor;
//                        ctx.fillText($scope.min, x, y);
//
//                        y = (canvas.width / 2.2) + calcPercent(canvas.height, 10) + (canvas.width / 100) - 1;
//                        x = canvas.width - (pad);
//                        ctx.font = 'normal ' + (fontSize / 2) + 'pt Calibri';
//                        ctx.fillStyle = $scope.smallTextColor;
//                        ctx.fillText($scope.max, x, y);
//                    }
//                }
//            }
//
//            var animate = function() {
//
//                var flag = direction == 1 ? (curValue <= endValue) : (curValue >= endValue);
//                if (flag == true) {
//                    render(curValue);
//
//                    curValue += direction;
//                    animID = requestAnimationFrame(animate);
//                } else {
//                    oldValue = endValue;
//                    render(endValue);
//                    cancelAnimationFrame(animID);
//                }
//            }
//
//
//
//
//            $scope.shadeColors = function(color, percent) {
//
//                var f = parseInt(color.slice(1), 16), t = percent < 0 ? 0 : 255;
//                var p = percent < 0 ? percent * -1 : percent;
//                var R = f >> 16;
//                var G = f >> 8 & 0x00FF;
//                var B = f & 0x0000FF;
//                return "#" + (0x1000000 + (Math.round((t - R) * p) + R) * 0x10000 + (Math.round((t - G) * p) + G) * 0x100 + (Math.round((t - B) * p) + B)).toString(16).slice(1);
//            }
//
//
//            $scope.$watch('val', function(newval, oldval) {
//
//                $scope.min = attrs.min || 0;
//                $scope.max = attrs.max || 100;
//                $scope.underColor = attrs.underColor || '#EFEFEF';
//                $scope.overColor = attrs.overColor || '#000';
//                $scope.textColor = attrs.textColor || $scope.overColor
//                $scope.smallTextColor = attrs.smallTextColor || getComputedStyle(element[0]).getPropertyValue("color");
//
//                curValue = parseFloat(oldValue);
//                endValue = parseFloat(newval);                      //alert(curValue + ' -- ' + endValue);
//                direction = endValue < curValue ? -1 : 1;
//                animate();
//
//            });
//
//        }
//    }
//});