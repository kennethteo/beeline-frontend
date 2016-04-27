var googleMaps;

export default [
  'uiGmapGoogleMapApi',
  '$cordovaGeolocation',
  function(uiGmapGoogleMapApi, $cordovaGeolocation) {
    this.defaultMapOptions = function(options) {
      var mapOptions = _.assign({
        center: {latitude: 1.370244, longitude: 103.823315},
        zoom: 11,
        bounds: { // so that autocomplete will mainly search within Singapore
          northeast: {
              latitude: 1.485152,
              longitude: 104.091837
            },
          southwest: {
              latitude: 1.205764,
              longitude: 103.589899
            }
        },
        control: {},
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
        markerOptions: {
          alightMarker: {},
          boardMarker: {},
          startMarker: {},
          endMarker: {},
        },
        events: {},
        markers: [],
        lines: [],
      }, options || {});

      uiGmapGoogleMapApi.then((googleMaps) => {
        mapOptions.markerOptions.boardMarker = ({
          icon: {
            url: 'img/map/MapRoutePickupStop@2x.png',
            scaledSize: new googleMaps.Size(26, 25),
            anchor: new googleMaps.Point(13, 13),
          },
        });
        mapOptions.markerOptions.alightMarker = ({
          icon: {
            url: 'img/map/MapRouteDropoffStop@2x.png',
            scaledSize: new googleMaps.Size(26, 25),
            anchor: new googleMaps.Point(13, 13),
          },
        });

        mapOptions.markerOptions.startMarker = {
          icon: {
            url: 'img/map/SelectedPinStart@2x.png',
            scaledSize: new googleMaps.Size(34, 46),
            anchor: new googleMaps.Point(17, 41),
          },
          zIndex: google.maps.Marker.MAX_ZINDEX + 1,
        };

        mapOptions.markerOptions.endMarker = {
          icon: {
            url: 'img/map/SelectedPinStop@2x.png',
            scaledSize: new googleMaps.Size(34, 46),
            anchor: new googleMaps.Point(17, 41),
          },
          zIndex: google.maps.Marker.MAX_ZINDEX + 1,
        };
      });

      return mapOptions;
    };

    this.locateMe = (mapControl) => function() {
      var options = {
        timeout: 5000,
        enableHighAccuracy: true
      };

      // promise
      $cordovaGeolocation
      .getCurrentPosition({timeout: 5000, enableHighAccuracy: true})
      .then(function(userpos) {
        if (!mapControl.getGMap) return;

        var gmap = mapControl.getGMap();

        gmap.panTo(new google.maps.LatLng(userpos.coords.latitude, userpos.coords.longitude));
        setTimeout(function() {
          gmap.setZoom(17);
        }, 300);

      }, function(err) {
        console.log('ERROR - ' + err);
      });
    };

  }
];
