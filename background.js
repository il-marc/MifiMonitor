lastupdate = {};
connection_history = [];
download_speed = [];
background = function($scope, $http, $interval){
    $scope.connection_history = [];
    $scope.sleepticks = 0; //used to pause the connection attempt for a period.
    connection_history = $scope.connection_history;
    $scope.refresh_data = function(){
        if($scope.sleepticks > 0){
            $scope.sleepticks -= 1;
            console.log("sleeping");
            return; //bail early
        }
        $http.get("http://mifi.admin/getStatus.cgi?dataType=TEXT").success(function(data, status){
            $scope.data = data;
            $scope.lastupdate = $scope.decode_data(data);
            lastupdate = $scope.lastupdate;
            console.log($scope.lastupdate);
            chrome.runtime.sendMessage("new_data_available");
        }).error(function(data, status){
            console.log(data);
                $scope.sleepticks = 6; //sleep for 6 periods
                //TODO: Make this backoff to a max value.
        });
    };
    $scope.decode_data = function(string){
        var pairs = string.split(/\x1B/);
        var result = {};
        angular.forEach(pairs, function(pair){
            var pieces = pair.split("=");
            result[pieces[0]] = pieces[1];
        });
        //make numbers be numbers
        var float_keys = ['WwSessionRxMb', 'WwSessionTxMb'];
        angular.forEach(float_keys, function(n_key){
            result[n_key] = parseFloat(result[n_key]);
        });
        //make ints ints
        var int_keys = ['WwSessionTimeSecs', 'BaBattCapacity', 'WiConnClients', 'BaBattChg', 'WwRssi'];
        angular.forEach(int_keys, function(n_key){
            result[n_key] = parseInt(result[n_key]);
        });
        //attach session start timestamp
        result['session_start'] = moment().subtract('seconds', result['WwSessionTimeSecs']);

        return result;
    };
    $scope.refresh_data();
    $interval($scope.refresh_data, 5000);
    $scope.$watch("lastupdate.WwSessionTimeSecs", function(newval, oldval){
        if( newval == undefined || oldval == undefined ){ return; }
        console.log("time update:", oldval, newval);
        if(oldval === undefined || oldval > newval){
            //reset occured
            //calculate timestamp of start

            $scope.connection_history.unshift($.extend({}, $scope.currentconnection));
        }
        $scope.currentconnection = $scope.lastupdate;
        //update ticker
        minutes_connected = 0;
        if(!isNaN(parseInt(newval))){
            minutes_connected = Math.ceil(parseInt(newval)/60);
        }
        chrome.browserAction.setBadgeText({
            'text': ''+ minutes_connected
        });
        var color = "#F00";
        if(minutes_connected > 5){
            color = "#0F0";
        }
        chrome.browserAction.setBadgeBackgroundColor({'color':color});
    }, true);

    $scope.download_speed = [];
    download_speed = $scope.download_speed;
    $scope.$watch("lastupdate.WwSessionRxMb", function(newval, oldval){
        if( newval == undefined || oldval == undefined || oldval > newval){ return; }
        console.log("download counter", newval, oldval);
        var kbs = (newval - oldval) * 1024 / 5;
        console.log("download speed (KB/s)",  kbs );
        //trim at 360 data points
        now_ms = (new Date()).getTime();
        now_ms -= (new Date()).getTimezoneOffset() * 60 * 1000;
        $scope.download_speed.push([now_ms, kbs]);
        //$scope.download_speed = $scope.download_speed.slice(Math.max($scope.download_speed.length - 360, 1)); //30 min
        var five_min_ago = now_ms - (5 * 60 * 1000);
        while($scope.download_speed.length > 60){
            /*if($scope.download_speed[0][0] > five_min_ago){
                console.log("everything within 5 minutes");
                break;

            }*/
            $scope.download_speed.shift();
            console.log("removed old entry");
        }
        //fix this to time limit it.
        download_speed = $scope.download_speed;
        chrome.runtime.sendMessage("download_speed-"+(new Date()).getTime()+"-"+kbs);
    });



};
//todo: battery charge reminder, log and show sessions with data counts, save to local db,
//
