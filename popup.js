angular.module('filters', []).filter('hms', function () {
    return function (secs) {
        var hours = 0;
        var mins = 0;
        if(secs > 60){
            mins = Math.floor(secs/60);
            secs -= mins * 60;
        }
        result = "";
        if(mins > 0){
            if(mins < 10){
                result += '0';
            }
            result += mins + ':';
        }

        if(secs < 10){
            result += '0';
        }
        result += secs;



        return result;
    };
});

angular.module('PopUpApp', ['filters']);



function PopUpCtrl($scope, $http, $timeout, $interval){

    document.getElementById("reconnect").addEventListener("click", function(event) {
        $scope.sleepticks = Number.MAX_VALUE;
        var stoken;
        $("#reconnect").button('loading');
        $.ajax('http://mifi.admin/')
        .then(function(result) {
            //Login
            console.log(result);
            var pwtoken = result.match(/pwtoken = "([a-z]+)"/)[1];
            stoken = result.match(/<input type="hidden" name="stoken" value="([a-z]+)">/)[1];
            console.log(pwtoken);
            console.log(stoken);
            var xsrf = $.param({
                buttonlogin: 'Login',
                AdPassword: hex_sha1('admin'+pwtoken),
                todo: 'login',
                nextfile: 'home.html',
                stoken: stoken
            });
            return $http({
                method: 'POST',
                url: 'http://mifi.admin/login.cgi',
                data: xsrf,
                headers: {'Content-Type': 'application/x-www-form-urlencoded'}
            });
        }).then(function (result) {
            //Disconnect
            var xsrf = $.param({
                NP_WiCurrPf: 'Secure',
                todo: 'disconnect',
                nextfile: '',
                stoken: stoken
            });
            return $http({
                method: 'POST',
                url: 'http://mifi.admin/home.cgi',
                data: xsrf,
                headers: {'Content-Type': 'application/x-www-form-urlencoded'}
            });
        }).then(function (result) {
            //Wait disconnected status
            function checkStatus (WwConnStatus) {
                if (WwConnStatus != 4) {
                    $http.get("http://mifi.admin/getStatus.cgi?dataType=TEXT").success(function(data, status){
                        WwConnStatus = data.match(/WwConnStatus=(\d)/)[1];
                        checkStatus(WwConnStatus);
                    });
                } else {
                    //Connect
                    var xsrf = $.param({
                        NP_WiCurrPf: 'Secure',
                        todo: 'connect',
                        WiCurrPf: 'Secure',
                        nextfile: '',
                        stoken: stoken
                    });
                    $http({
                        method: 'POST',
                        url: 'http://mifi.admin/home.cgi',
                        data: xsrf,
                        headers: {'Content-Type': 'application/x-www-form-urlencoded'}
                    });
                    $("#reconnect").button('reset');
                    $scope.sleepticks = 1;
                }
            }
            checkStatus(0);
        });
    });

    $scope.update_pending = true;
    $scope.pull_new_data = function(){
        console.log("pulling new data");

        $scope.data = chrome.extension.getBackgroundPage().lastupdate;
        $scope.connection_history = chrome.extension.getBackgroundPage().connection_history;
        $scope.download_speed = chrome.extension.getBackgroundPage().download_speed;
        $scope.update_pending = false;

        //update chart
        var download_series = $('#speed_graph').highcharts().get("download_speed");
        if(download_series.data.length == 0){
            download_series.setData($scope.download_speed);
        } else {
            //third arg is shift, will loose the last point.
            var remove = download_series.data.length >= 60; //5 minutes
            download_series.addPoint($scope.download_speed[$scope.download_speed.length -1], true, remove);
        }

    };

    $('#speed_graph').highcharts({
            chart: {
                type: 'spline',
                animation: Highcharts.svg, // don't animate in old IE
                marginRight: 10
            },
            title: {
                text: ''
            },
            credits: {
                enabled: false
            },
            xAxis: {
                type: 'datetime',
                //tickPixelInterval: 150
                dateTimeLabelFormats: {
                    millisecond: '%H:%M:%S',
                    second: '%H:%M:%S',
                    minute: '%H:%M',
                    hour: '%H:%M',
                    day: '%e. %b',
                    week: '%e. %b',
                    month: '%b \'%y',
                    year: '%Y'
                }
            },
            yAxis: {
                title: {
                    text: 'KB/s'
                },
                min: 0,
                plotLines: [{
                    value: 0,
                    width: 1,
                    color: '#808080'
                }]
            },
            tooltip: {
                formatter: function() {
                        return '<b>'+ this.series.name +'</b><br/>'+
                        Highcharts.dateFormat('%Y-%m-%d %H:%M:%S', this.x) +'<br/>'+
                        Highcharts.numberFormat(this.y, 2) + 'KB/s';
                }
            },
            plotOptions: {
                spline: {
                    color: '#fa2100',
                    marker: {
                        enabled: false
                    }
                },
                line : {
                }
            },
            legend: {
                enabled: false
            },
            exporting: {
                enabled: false
            },
            series: [{
                name: 'Download KB/s',
                id: 'download_speed',
                data: []
            }]
        });

    $scope.do_reload = function(){
        console.log("requesting new data");
        $scope.update_pending = true;
        //chrome.extension.getBackgroundPage().fullReload();
    };

    $scope.pull_new_data();

    $scope.ischarging = function(){
        return $scope.data.BaBattChg == 1;
    };

    $scope.total_data = function(){
        return  +$scope.data.WwSessionRxMb + +$scope.data.WwSessionTxMb
    };

    $scope.connected_min = function(){
        return +$scope.data.WwSessionTimeSecs / 60;
    };
}

chrome.runtime.onMessage.addListener(function(message, sender, sendResponse){
    if(message === "new_data_available"){
        console.log("new data!");
        angular.element(document.body).scope().$apply(function($scope){
            $scope.pull_new_data();
        });
    }

});