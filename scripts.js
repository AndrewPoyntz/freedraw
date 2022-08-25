const LAT_LNG = [53.905, -3.2];
const TILE_URL = 'https://cartodb-basemaps-a.global.ssl.fastly.net/light_all/{z}/{x}/{y}@2x.png';
let map;
let freeDraw;
drawing = true;
const polys = L.featureGroup()
$(document).ready(function() {
	const sliderCookie = Cookies.get('slider')
	const sliderValue = (sliderCookie) ? parseFloat(sliderCookie) : 1;

	$('#slider').slider({
		min:0,
		max:3,
		step:0.1,
		value:sliderValue,
		change: function( event, ui ) {
			Cookies.set('slider', ui.value);
			location.reload();
		}
	});
	if ($('#smoothing').is(':checked')){
		$('#showBoth').show();
	}
	$('#smoothing').change(function () {
		if ($(this).is(':checked')) {
			$('#showBoth').show();
		} else {
			$('#showBoth').hide();
		}
	});
	$('#clear').click(function() {
		polys.clearLayers();
	});
	$('#Draw').click(function(){
		if (drawing) {
			freeDraw.mode(FreeDraw.NONE);
			$(this).html('Drawing (off)');
		} else {
			freeDraw.mode(FreeDraw.ALL);
			$(this).html('Drawing (on)');
		}
		drawing = !drawing;
	})
	map = new L.Map(document.querySelector('section.map'), { doubleClickZoom: false }).setView(LAT_LNG, 6);
	L.tileLayer(TILE_URL).addTo(map);
	polys.addTo(map);
	addFreedraw(sliderValue);
	freeDraw.on('markers', freedrawEvent)

})
addFreedraw = function (simplfyFactor) {
	freeDraw = new FreeDraw({ mode: FreeDraw.ALL, simplifyFactor:simplfyFactor});
	map.addLayer(freeDraw);
}
freedrawEvent = function(event) {
	if (event.eventType === 'create'){
		drawPoly(event.latLngs);
		freeDraw.clear();
	}
}
drawPoly = function (latLngs) {
	// console.log('create poly with', latLngs)
	let numPoints = 'Points in last drawn shape:'
	const polygon = L.polygon(latLngs);
	// console.log(polygon.toGeoJSON())

	if ($('#smoothing').is(':checked'))  {
		if ($('#both').is(':checked')) {
			numPoints += '<br/>non-smooth: ' + drawNormal(polygon, latLngs) + '<br>';
		}
		numPoints += 'smooth: ' + drawSmoothed(polygon);
	} else {
		numPoints +=  drawNormal(polygon, latLngs);
	}
	$('#numPoints').html(numPoints);

}
drawNormal = function (polygon, latLngs){
	polys.addLayer(polygon);
	for (let i = 0; i < latLngs[0].length; i++) {
		polys.addLayer(L.circleMarker(latLngs[0][i], {radius: 2}));
	}
	return latLngs[0].length;
}
drawSmoothed = function (polygon) {
	const smoothedLatLngs = (turf.flip(turf.polygonSmooth(polygon.toGeoJSON(), {iterations:3}))).features[0].geometry.coordinates;
	// console.log(smoothedLatLngs);
	polys.addLayer(L.polygon(smoothedLatLngs, {color:'green'}))
	for (let i = 0; i < smoothedLatLngs[0].length; i++) {
		polys.addLayer(L.circleMarker(smoothedLatLngs[0][i], {radius: 2, color: 'green'}));
	}
	return smoothedLatLngs[0].length;
}
