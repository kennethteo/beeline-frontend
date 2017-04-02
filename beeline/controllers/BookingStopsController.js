import {NetworkError} from '../shared/errors';
import {formatDate, formatTime, formatUTCDate, formatHHMM_ampm, formatDateMMMdd} from '../shared/format';

export default [
  '$rootScope',
  '$scope',
  '$interpolate',
  '$state',
  '$stateParams',
  '$ionicModal',
  '$http',
  '$cordovaGeolocation',
  'BookingService',
  'RoutesService',
  'UserService',
  'uiGmapGoogleMapApi',
  'MapOptions',
  'loadingSpinner',
  '$q',
  'TicketService',
  function(
    $rootScope,
    $scope,
    $interpolate,
    $state,
    $stateParams,
    $ionicModal,
    $http,
    $cordovaGeolocation,
    BookingService,
    RoutesService,
    UserService,
    uiGmapGoogleMapApi,
    MapOptions,
    loadingSpinner,
    $q,
    TicketService
  ) {
    // Gmap default settings
    $scope.map = MapOptions.defaultMapOptions();
    $scope.routePath = [];

    // Booking session logic
    $scope.session = {
      sessionId: null,
    };
    // Default settings for various info used in the page
    $scope.book = {
      routeId: null,
      route: null,
      boardStops: [], // all board stops for this route
      alightStops: [], // all alight stops for this route
      boardStop: null,
      alightStop: null,
      changes: {},
      nextTripDate: null,
      hasNextTripTicket: null, // user already bought the ticket
      previouslyBookedDays: null,
      buttonText: 'Book Next Trip'
    };
    $scope.disp = {
      popupStop: null,
      popupStopType: null,
      parentScope: $scope,
    }

    // Resolved when the map is initialized
    var gmapIsReady = new Promise((resolve, reject) => {
      var resolved = false;
      $scope.$watch('map.control.getGMap', function() {
        if ($scope.map.control.getGMap) {
          if (!resolved) {
            resolved = true;
            resolve();
          }
        }
      });
    });

    $scope.session.sessionId = +$stateParams.sessionId;
    $scope.book.routeId = +$stateParams.routeId;

    var routePromise = RoutesService.getRoute($scope.book.routeId)

    var stopOptions = {
      initialBoardStopId: $stateParams.boardStop ? parseInt($stateParams.boardStop) : undefined,
      initialAlightStopId: $stateParams.alightStop ? parseInt($stateParams.alightStop) : undefined,
    };

    var routePostProcessingPromise = routePromise.then((route) => {
      $scope.book.route = route;
      computeStops(stopOptions);
    });

    var ridesRemainingPromise = RoutesService.fetchRoutePassCount()

    $q.all([routePromise, ridesRemainingPromise]).then(function(values){
      let ridesRemainingMap = values[1]
      if(ridesRemainingMap){
        $scope.book.route.ridesRemaining = ridesRemainingMap[$scope.book.routeId]
      } else {
        $scope.book.route.ridesRemaining = null;
      }
    })

    $scope.$on('$ionicView.afterEnter', () => {
      loadingSpinner(Promise.all([gmapIsReady, routePromise])
      .then(() => {
        var gmap = $scope.map.control.getGMap();
        google.maps.event.trigger(gmap, 'resize');
        panToStops();
      }));
    });

    gmapIsReady.then(function() {
      MapOptions.disableMapLinks();
    });

    $scope.$watch('book.route.path', (path) => {
      if (!path) {
        $scope.routePath = [];
      }
      else {
        RoutesService.decodeRoutePath(path)
        .then((decodedPath) => $scope.routePath = decodedPath)
        .catch(() => $scope.routePath = []);
      }
    })

    $scope.applyTapBoard = function (stop) {
      $scope.disp.popupStopType = "pickup";
      $scope.disp.popupStop = stop;
      $scope.$digest();
    }
    $scope.applyTapAlight = function (stop) {
      $scope.disp.popupStopType = "dropoff";
      $scope.disp.popupStop = stop;
      $scope.$digest();
    }
    $scope.setStop = function (stop, type) {
      if (type === 'pickup') {
        $scope.book.boardStop = stop;
      }
      else {
        $scope.book.alightStop = stop;
      }
      $scope.disp.popupStop = null;
    }
    $scope.closeWindow = function () {
      $scope.disp.popupStop = null;
    }

    /* Pans to the stops on the screen */
    function panToStops() {
      var stops = [];
      stops = $scope.book.boardStops.concat($scope.book.alightStops);

      if (stops.length == 0) {
        return;
      }
      var bounds = new google.maps.LatLngBounds();
      for (let s of stops) {
        bounds.extend(new google.maps.LatLng(
          s.coordinates.coordinates[1],
          s.coordinates.coordinates[0]
        ));
      }
      $scope.map.control.getGMap().fitBounds(bounds);
    }

    /** Summarizes the stops from trips by comparing their stop location and time */
    function computeStops({initialBoardStopId, initialAlightStopId}) {
      var trips = $scope.book.route.trips;
      var [boardStops, alightStops] = BookingService.computeStops(trips);
      $scope.book.boardStops = boardStops;
      $scope.book.alightStops = alightStops;

      // Check that the boardStopIds are still valid
      if (typeof(initialBoardStopId) === 'number') {
        $scope.book.boardStop = boardStops.find(ts =>
            ts.id === initialBoardStopId);
      }
      // Check that the boardStopIds are still valid
      if (typeof(initialAlightStopId) === 'number') {
        $scope.book.alightStop = alightStops.find(ts =>
            ts.id === initialAlightStopId);
      }
    }


    //get the next available trip date everytime when this view is active
    $scope.$on('$ionicView.enter', () => {
      loadingSpinner(routePromise.then((route) => {
        var runningTrips = route.trips.filter(tr => tr.isRunning);
        //compare current date with nearest date trip's 1st board stop time
        var sortedTripInDates = _.sortBy(runningTrips,'date');
        var now = Date.now();
        for (let trip of sortedTripInDates) {
          var sortedTripStopsInTime = _.sortBy(trip.tripStops,'time');
          //FIXME: need to take booking window into account
          //check seat is available
          if (now < sortedTripStopsInTime[0].time.getTime() && trip.availability.seatsAvailable > 0) {
            $scope.book.nextTripDate = [trip.date.getTime()];
            $scope.book.buttonText = $scope.book.buttonText.concat(' ('+formatDateMMMdd($scope.book.nextTripDate[0])+' )');
            break;
          }
        }
      }));
    });

    // get user object
    $scope.$watchGroup([() => UserService.getUser(), 'book.nextTripDate', 'book.previouslyBookedDays'], ([user, nextTripDate, previouslyBookedDays]) => {
      $scope.isLoggedIn = user ? true : false;
      $scope.user = user;
      if ($scope.isLoggedIn) {
        //check user has next trip ticket or not
        if (previouslyBookedDays == null) {
          loadingSpinner(TicketService.getPreviouslyBookedDaysByRouteId($scope.book.routeId, true).then ((tickets)=>{
            $scope.book.previouslyBookedDays = tickets || {};
          }));
        }
        if (previouslyBookedDays) {
          var bookedDays = Object.keys(previouslyBookedDays).map(x=>{return parseInt(x)});
          //compare current date with next trip
          if (nextTripDate && _.includes(bookedDays,nextTripDate[0])) {
            $scope.book.hasNextTripTicket = true;
            $scope.book.buttonText = 'Go to Ticket View';
          } else {
            $scope.book.hasNextTripTicket = false;
          }

        } else {
          $scope.book.hasNextTripTicket = false;
        }
      } else {
        $scope.book.previouslyBookedDays = null;
        $scope.book.hasNextTripTicket = false;
      }
    })

    $scope.fastCheckout = function(){
      if ($scope.isLoggedIn) {
        $state.go('tabs.booking-summary', {routeId: $scope.book.routeId,
        boardStop: $scope.book.boardStop.id,
        alightStop: $scope.book.alightStop.id,
        sessionId: $scope.session.sessionId,
        selectedDates: $scope.book.nextTripDate,});
      } else {
        UserService.promptLogIn();
      }
    }

    $scope.continue = function() {
      if ($scope.book.hasNextTripTicket) {
        $state.go('tabs.tickets');
      } else {
        $scope.fastCheckout();
      }
    }
  }
];
