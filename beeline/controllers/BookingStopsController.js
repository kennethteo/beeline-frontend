import {NetworkError} from '../shared/errors'
import {formatDate, formatTime, formatUTCDate,formatHHMM_ampm} from '../shared/format'

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
  'CompanyService',
  'uiGmapGoogleMapApi',
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
    CompanyService,
    uiGmapGoogleMapApi
  ) {
    //Gmap default settings
    $scope.map = {
      center: { latitude: 1.370244, longitude: 103.823315 },
      zoom: 11,
      bounds: { //so that autocomplete will mainly search within Singapore
        northeast: {
          latitude: 1.485152,
          longitude: 104.091837
        },
        southwest: {
          latitude: 1.205764,
          longitude: 103.589899
        }
      },
      mapControl: {},
      options: {
        disableDefaultUI: true,
        styles: [{
          featureType: "poi",
          stylers: [{
            visibility: "off"
          }]
        }],
        draggable: true
      },
      markers: [],
      lines: [],
    };

    var resolveGmap = null;
    var gmapIsReady = new Promise((resolve, reject) => {
      resolveGmap = resolve;
    });
    $scope.mapReady = function() {
      resolveGmap();
    }

    //Default settings for various info used in the page
    $scope.book = {
      routeid: '',
      boardStops: [],
      alightStops: [],
      stime: '',
      etime: '',
      sroad: '',
      eroad: '',
      stxt: 'Select your pick-up stop',
      etxt: 'Select your drop-off stop',
      ptxt: 'No. of passengers',
      transco: {},
      allDataNotFilled: true,
      termsChecked: false,
      errmsg: ''
    }

    // Name when controller was fired??
    // Maybe find a neater solution?
    var stateName = $state.current.name;
    $scope.currentBooking = {};

    $scope.$on('$ionicView.beforeEnter', () => {
      BookingService.reset($state.params.routeId)
      $scope.currentBooking = BookingService.getCurrentBooking();
    });

    $scope.setStop = function () {
      var stop = $scope.infoStop;
      var type = $scope.infoType

      $scope.$apply(() => {
        if (type == 'board') {
          $scope.currentBooking.boardStop = stop.id;
        }
        else {
          $scope.currentBooking.alightStop = stop.id;
        }

        /* Hide the infowindow */
        $scope.infoStop = null;
        $scope.infoType = null;
      });
    };

    //
    function resizeMap() {
      gmapIsReady
      .then(() => {
        google.maps.event.trigger($scope.map.mapControl.getGMap(), 'resize');
      });
    }

    $scope.$on('$ionicView.afterEnter', () => {
      /* Do this hackery because the content of an infowindow
      may not handle event handlers correctly */
      window.setStop = $scope.setStop;
      resizeMap();
      $scope.displayRouteInfo();
    });

    // Subcomponents, views etc
    $scope.$on('$destroy', () => {
      if ($scope.changesModal) {
        $scope.changesModal.remove();
      }
    });

    $scope.title = $scope.state == 'tabs.booking-pickup' ?
        'Select Pick-up and Drop-off Points' :
        'Select Drop-off Point';
    $scope.routePath = [];

    /* These function teaches the <bus-stop-selector> how
     to display the stop id and description */
    $scope.getStopId = (stop) => stop.id;
    $scope.getStopDescription = (stop) =>
      formatTime(stop.time) + ' \u00a0\u00a0' + stop.description;
    $scope.getStopDescription2 = (stop) =>
      stop.road;

    $scope.boardMarkerOptions = {};
    $scope.alightMarkerOptions = {};

    // FIXME: apply this to all maps somehow, instead of doing this ad-hoc
    uiGmapGoogleMapApi.then(() => {
      setTimeout(function(){
        //Disable the Google link at the bottom left of the map
        var glink = angular.element(document.getElementsByClassName("gm-style-cc"));
        glink.next().find('a').on('click', function (e) {
          e.preventDefault();
        });
      }, 300);

      $scope.alightMarkerOptions = {
        icon: {
          url: 'img/alight.png',
          scaledSize: new google.maps.Size(20,20),
          anchor: new google.maps.Point(5,5),
        },
      };
      $scope.boardMarkerOptions = {
        icon: {
          url: 'img/board.png',
          scaledSize: new google.maps.Size(20,20),
          anchor: new google.maps.Point(5,5),
        },
      };
    })

    // Load the data for the selected route
    // Which data?
    // 1. Route info
    // 2. Company info
    // 3. Changes to route
    $scope.lastDisplayedRouteId = null; // works if caching
    $scope.displayRouteInfo = function() {
      RoutesService.getRoute($scope.currentBooking.routeId)
      .then((route) => {
        // 1. Route info
        $scope.routePath = route.path.map(latlng => ({
          latitude: latlng.lat,
          longitude: latlng.lng,
        }));
        $scope.currentBooking.route = route;

        computeStops();
        panToStops();

        // 3. Check if we should display changes
        if ($scope.lastDisplayedRouteId != $scope.currentBooking.routeId) {
          var changes = BookingService.computeChanges(route);
          $scope.currentBooking.changes = changes;

          if (changes.priceChanges.length == 0 &&
              changes.stopChanges.length == 0 &&
              changes.timeChanges.length == 0) {
            return
          }

          console.log('Changes detected: diplaying message box');

          if ($scope.changesModal) {
            $scope.changesModal.remove();
            $scope.changesModal = null;
          }

          if ($scope.changesModal) {
            $scope.changesModal.show();
          }
          else {
            $ionicModal.fromTemplateUrl('changes-message.html', {
              scope: $scope,
              animation: 'slide-in-up',
            })
            .then(modal => {
              $scope.changesModal = modal;
              $scope.changesModal.show();
            });
          }
        }
        $scope.lastDisplayedRouteId = $scope.currentBooking.routeId;

        // 2. Fill in the transport company info
        return CompanyService.getCompany(route.trips[0].transportCompanyId)
        .then(function(result){
          $scope.currentBooking.company = result;
        });
      })
      .then(null, err => console.log(err.stack));
    };

    $scope.closeChangesModal = function() {
      $scope.changesModal.hide();
    }

    /* ----- Methods ----- */
    //Click function for User Position Icon
    $scope.getUserLocation = function() {
      var options = {
        timeout: 5000,
        enableHighAccuracy: true
      };

      //promise
      $cordovaGeolocation
      .getCurrentPosition({ timeout: 5000, enableHighAccuracy: true })
      .then(function(userpos){

        var gmap = $scope.map.mapControl.getGMap();

        gmap.panTo(new google.maps.LatLng(userpos.coords.latitude, userpos.coords.longitude));
        setTimeout(function(){
          gmap.setZoom(17);
        }, 300);

      }, function(err){
        console.log('ERROR - ' + err);
      });
    }

    function computeStops() {
      var trips = $scope.currentBooking.route.trips;
      var tripStops = _.flatten(trips.map(trip => trip.tripStops));
      var uniqueStops = _.uniqBy(tripStops, ts => ts.stop.id)
      var stopData = _.keyBy(uniqueStops, ts => ts.stop.id);

      var boardStops = uniqueStops.filter(ts => ts.canBoard)
        .map(ts => {
          return _.extend({time: ts.time}, ts.stop);
        })
      var alightStops = uniqueStops.filter(ts => ts.canAlight)
        .map(ts => {
          return _.extend({time: ts.time}, ts.stop);
        })

      $scope.book.boardStops = boardStops;
      $scope.book.alightStops = alightStops;
    }

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
      $scope.map.mapControl.getGMap().fitBounds(bounds);
    };

    $scope.tapBoard = function (board) {
      // nconsole.log($state);
      window.setStop = $scope.setStop;
      $scope.infoStop = board;
      $scope.infoType = 'board';
    };
    $scope.tapAlight = function (alight) {
      window.setStop = $scope.setStop;
      $scope.infoStop = alight;
      $scope.infoType = 'alight';
    };
    $scope.applyTapAlight = (x) => $scope.$apply(() => $scope.tapAlight(x));
    $scope.applyTapBoard = (x) => $scope.$apply(() => $scope.tapBoard(x));

    //Check whether:
    //[1] Start stop is specified
    //[2] End stop is specified
    //[3] Checkbox is checked
    $scope.$watchGroup([
        'currentBooking.boardStop',
        'currentBooking.alightStop',
        'book.termsChecked',
      ], function () {
        if ($scope.book.termsChecked == true) {
          $scope.book.errmsg = '';
          var curr = $scope.currentBooking;

          if (typeof(curr.boardStop) == 'undefined')
            $scope.book.errmsg = 'Please specify a Boarding Stop.'
          else if (typeof(curr.alightStop) == 'undefined')
            $scope.book.errmsg = 'Please specify a Alighting Stop.'
          else
          {
            $scope.book.errmsg = ''
            $scope.book.allDataNotFilled = false;
          }
        }
      });

    console.log('Revised(2) ' + stateName);
  }
];