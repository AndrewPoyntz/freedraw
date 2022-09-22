const LAT_LNG = [53.905, -3.2];
const TILE_URL = 'https://cartodb-basemaps-a.global.ssl.fastly.net/light_all/{z}/{x}/{y}@2x.png';
let map;
let freeDraw;
drawing = true;
const current = L.featureGroup();
const smooth = L.featureGroup();
const currentPoints = L.featureGroup();
const smoothPoints = L.featureGroup();
$(document).ready(function() {
	map = new L.Map(document.querySelector('section.map'), { doubleClickZoom: false }).setView(LAT_LNG, 6);
	L.tileLayer(TILE_URL).addTo(map);
	const sliderCookie = Cookies.get('slider')
	const sliderValue = (sliderCookie) ? parseFloat(sliderCookie) : 1;
	const toggleDrawing = function () {
		if (drawing) {
			freeDraw.mode(FreeDraw.NONE);
			$('#Draw').html('Drawing (off)');
		} else {
			freeDraw.mode(FreeDraw.ALL);
			$('#Draw').html('Drawing (on)');
		}
		drawing = !drawing;

	}
	$(document).keypress(function (e) {
		if (e.keyCode = 32){
			toggleDrawing();
		}
	})
	if($('#current').is(':checked')) {
		current.addTo(map);
	}
	$('#current').change(function () {
		if ($(this).is(':checked')) {
			if($('#points').is(':checked')){
				currentPoints.addTo(map);
			}
			current.addTo(map);
		} else {
			current.remove();
			currentPoints.remove()
		}
	});
	if($('#smooth').is(':checked')) {
		smooth.addTo(map);
	}
	$('#smooth').change(function () {
		if ($(this).is(':checked')) {
			if($('#points').is(':checked')){
				smoothPoints.addTo(map);
			}
			smooth.addTo(map);
		} else {
			smooth.remove();
			smoothPoints.remove();
		}
	});
	if($('#points').is(':checked')){
		if($('#smooth').is(':checked')) {
			smoothPoints.addTo(map);
		}
		if($('#current').is(':checked')) {
			currentPoints.addTo(map);
		}
	}
	$('#points').change(function () {
		if ($(this).is(':checked')) {
			if($('#smooth').is(':checked')) {
				smoothPoints.addTo(map);
			}
			if($('#current').is(':checked')) {
				currentPoints.addTo(map);
			}
		} else {
			currentPoints.remove();
			smoothPoints.remove();
		}
	});
	$('#clear').click(function() {
		current.clearLayers();
		smooth.clearLayers();
		currentPoints.clearLayers();
		smoothPoints.clearLayers();
	});
	$('#Draw').click(function(){
		toggleDrawing();
	})
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
	const polygon = L.polygon(latLngs);
	// console.log(polygon.toGeoJSON())
	const normal = drawNormal(polygon, latLngs);
	const smoothed = drawSmoothed(polygon, latLngs);
	let numPoints = 'Points in last drawn shape:' +
		'<br/>non-smooth: ' + normal + '<br>' +
		'smooth: ' + smoothed;
	$('#numPoints').html(numPoints);

}
drawNormal = function (polygon, latLngs){
	current.addLayer(polygon);
	for (let i = 0; i < latLngs[0].length; i++) {
		currentPoints.addLayer(L.circleMarker(latLngs[0][i], {radius: 2}));
	}
	return latLngs[0].length;
}
drawSmoothed = function (polygon) {
	const smoothedLatLngs = (turf.flip(turf.polygonSmooth(polygon.toGeoJSON(), {iterations:3}))).features[0].geometry.coordinates;
	// console.log(smoothedLatLngs);
	smooth.addLayer(L.polygon(smoothedLatLngs, {color:'green', weight: 2, opacity:0.7}))
	for (let i = 0; i < smoothedLatLngs[0].length; i++) {
		smoothPoints.addLayer(L.circleMarker(smoothedLatLngs[0][i], {radius: 1, color: 'green'}));
	}
	return smoothedLatLngs[0].length;
}
