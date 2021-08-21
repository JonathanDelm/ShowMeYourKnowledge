var initialEstValue;
var data;
var hintBarID;
var xAxisName;
var yAxisName;
var unitName;
var svg = null;
var width;
var height;
const margin = { top: 30, bottom: 80, left: 75, right: 25 };

var x;
const axisNumberFormat = {
	'decimal': ',',
	'thousands': ' ',
	'grouping': [3],
	'currency': ['', ''],
};
this.d3.formatDefaultLocale(axisNumberFormat);
var maxYVal;
var y;
var tool_tip;
var tool_tip_hint;
var brushY;


// COLORS
const barColor = "#3F3F3F";
const barHoverColor = '#b3b3b3';
const colorUp = "#FFA500";
const colorUpHover = "#ffe4b2";
const colorUpText = "#FFA500";
const colorDown = "#005AFF";
const colorDownHover = "#b2cdff";
const colorDownText = "#005AFF";
const barOutlineColor = "rgba(63,63,63,0.1)";
const barOutlineColorHover = "rgba(63,63,63,0.03)";


// VARS NEEDED FOR ANIMATION
const animationDuration = 2000;
const waitDuration = 1000;
var animating = true;
var initialized = false;
var showEstimate = false;

window.addEventListener("load", function(event) {
	initialized = false;

	// DELETE ESTIMATE
	if (svg != null) {
		svg.selectAll("*").remove();
		d3.select("svg").remove();
	}

	// SET DATA
	const queryString = window.location.search;
	const urlParams = new URLSearchParams(queryString);
	const params = urlParams.get('params');
	if (params) {
		dataObj = JSON.parse(atob(params));
		hintBarID = dataObj.hintBarID-1;
		data = setData(dataObj.data, dataObj.initialEstValue, hintBarID);
		xAxisName = dataObj.xAxisName;
		yAxisName = dataObj.yAxisName;
		unitName = dataObj.unitName;
	} else {
		hintBarID = 5;
		initialEstValue = 20000;
		data = [
			{ name: "10-19", value: 113750, est: initialEstValue },
			{ name: "20-29", value: 161355, est: initialEstValue },
			{ name: "30-39", value: 154483, est: initialEstValue },
			{ name: "40-49", value: 153037, est: initialEstValue },
			{ name: "50-59", value: 142577, est: initialEstValue },
			{ name: "60-69", value: 83979, est: 83979 },
			{ name: "70-79", value: 55547, est: initialEstValue },
			{ name: "80+", value: 81058, est: initialEstValue }
		];
		xAxisName = "Leeftijdscategorie";
		yAxisName = "Aantal bevestigde besmettingen";
		unitName = "cases";
	}
	width = 1000;
	height = 500;

	x = d3.scaleBand()
		.domain(d3.range(data.length))
		.range([margin.left, width - margin.right])
		.padding(0.3);

	maxYVal = Math.max.apply(Math, data.map(function(o) { return o.value; }))

	y = d3.scaleLinear()
		.domain([0, maxYVal+maxYVal/6])
		.range([height - margin.bottom, margin.top])

	tool_tip = d3.tip()
		.attr("class", "d3-tip")
		.offset(function(d){
			var y = x.bandwidth()/2.2 + 19 + (d.value.toString().length-1)*4.1;
			return [17.2,y];
		})
		.html(
			function(d) {
				if (showEstimate) {
					showEstimate = false;
					return d3.format(" ,")(d.est); 
				} else {
					showEstimate = false;
					return d3.format(" ,")(d.value); 
				}
			}
		);

	tool_tip_hint = d3.tip()
		.attr("class", "d3-tip-hint")
		.offset(function(d){
			return [-20,0];
		})
		.html(
			function(d) {
				return "This bar was given as a hint"; 
			}
		);
		
	// DRAG FUNCTIONALITY (https://github.com/d3/d3-brush)
	brushY = d3.brushY()
		// Set overlay in which to expand/shrink the bar
		.extent(function (d, i) {
				return [[x(i), y(maxYVal + maxYVal/6)],
								// Set minimal value
								[x(i) + x.bandwidth(), y(1)]];})
		.on("start", startMoveY)
		.on("brush", brushmoveY)
		.on("end", endMoveY)
		.handleSize([20]);

	document.getElementById("feedback").style.display="none";

	svg = d3.select("#comparison-container")
		.append("svg")
		.attr("width", width - margin.left - margin.right)
		.attr("height", height - margin.top - margin.bottom)
		.attr("viewBox", [0, 0, width, height]);

	svg.append("g").call(make_y_gridlines);
	svg.call(tool_tip_hint);

	svg
		.selectAll('.brush')
			.data(data)
		.enter()
			.append('g')
				.attr('class', 'brush')
				.attr("id", function(d,i){ return "brush"+i})
			.call(brushY)
			// Set initial height
			.call(brushY.move, function (d, i){
				if (i === hintBarID) {
					return [d.value, 0].map(y);
				} else {
					return [d.est, 0].map(y);
				}
			});

	d3.selectAll('.brush>.handle--s').remove();
	d3.select('#brush'+hintBarID+'>.handle--n').style('pointer-events', 'none');

	svg.selectAll("rect").filter(".selection")
		.attr("id", function(d,i){ return "bar"+i})
		.on("mouseover", function(d, i) {	if(!animating) {handleMouseOverEst(d,i)}})
		.on("mouseout", function(d, i) { if(!animating) {handleMouseOutEst(d,i)}});

	svg.selectAll("rect").filter(".handle--n")
		.attr("id", function(d,i){ return "handle"+i})
		.on("mouseover", function(d, i) { if(!animating) {handleMouseOverEst(d,i)}})
		.on("mouseout", function(d, i) { if(!animating) {handleMouseOutEst(d,i)}});

	svg.append("g").call(xAxis);
	svg.append("text")      
		// text label for the x axis
		.attr("x", height )
		.attr("y", height - 25 )
		.style("text-anchor", "middle")
		.attr("font-size", '18px')
		.attr("font-family", "'Libre Franklin', sans-serif")
		.text(xAxisName);

	svg.append("g").call(yAxis);
	svg.append("text")
		.attr("transform", "rotate(-90)")
		.attr("y", 0 - margin.left+25)
		.attr("x",0 - (height / 2))
		.attr("dy", "1em")
		.style("text-anchor", "middle")
		.attr("font-size", '18px')
		.attr("font-family", "'Libre Franklin', sans-serif")
		.text(yAxisName);

	initialized = true;
}, false);

/* ----- COMPARISONS ----- */
d3.select("button").on("click", function(event) {	

	document.getElementById("button").style.display="none";

	// DELETE ESTIMATE
	svg.selectAll("*").remove();
	d3.select("svg").remove();

	svg = d3.select("#comparison-container")
		.append("svg")
		.attr("width", width - margin.left - margin.right)
		.attr("height", height - margin.top - margin.bottom)
		.attr("viewBox", [0, 0, width, height]);

	svg.append("g").call(xAxis);
	svg.append("text")      // text label for the x axis
				.attr("x", height )
				.attr("y", height - 25 )
        .style("text-anchor", "middle")
				.attr("font-size", '18px')
				.attr("font-family", "'Libre Franklin', sans-serif")
				.text(xAxisName);

	svg.append("g").call(yAxis);
	svg.append("text")
		.attr("transform", "rotate(-90)")
		.attr("y", 0 - margin.left+25)
		.attr("x",0 - (height / 2))
		.attr("dy", "1em")
		.style("text-anchor", "middle")
		.attr("font-size", '18px')
		.attr("font-family", "'Libre Franklin', sans-serif")
		.text(yAxisName);
		svg.append("g").call(make_y_gridlines);

	svg.call(tool_tip);
	svg.call(tool_tip_hint);

	// ADD BAR 'OUTLINE' => GREY ZONE
	svg
	.append("g")
	.attr("fill", barOutlineColor)
	.selectAll("rect")
	.data(data)
	.join("rect")
		.attr("id", function(d,i){ return "barOutline"+i})
		.attr("x", (data, index) => x(index))
		.attr("y", d => y(d.est))
		.attr("height", d => y(0) - y(d.est))
		.attr("width", x.bandwidth())
		.attr("class", "rect")
		.on("mouseover", function(d, i) {	if(!animating) {handleMouseOver(d, i)}})
		.on("mouseout", function(d, i) { if(!animating) {handleMouseOut(d,i)}});

	// ADD BARS
	svg
		.append("g")
		.attr("fill", barColor)
		.selectAll("rect")
		.data(data)
		.join("rect")
			.attr("id", function(d,i){ return "bar"+i})
			.attr("x", (data, index) => x(index))
			.attr("y", d => y(d.est))
			.attr("height", d => y(0) - y(d.est))
			.attr("width", x.bandwidth())
			.attr('title', (d) => d.value)
			.attr("class", "rect")
			.on("mouseover", function(d, i) {	if(!animating) {handleMouseOver(d, i)}})
			.on("mouseout", function(d, i) { if(!animating) {handleMouseOut(d,i)}});
	
	// ADD ESTIMATE LINES
	svg.append('g')
		.selectAll('line')
		.data(data)
		.join("line")
			.style("visibility", "hidden")
			.style("stroke", (d) => upOrDownColor(d))
			.style("stroke-width", 3)
			.attr("x1", (data, index) => x(index))
			.attr("y1", d => y(d.est))
			.attr("x2", (data, index) => (x(index) + x.bandwidth()))
			.attr("y2", d => y(d.est))
			.attr("id", function(d,i){ 
				if(d.value > d.est) {
					return "lineUp"+i;
				} else {
					return "lineDown"+i;
				}
			})
			.on("mouseover", function(d, i) {	if(!animating) {handleMouseOver(d, i)}})
			.on("mouseout", function(d, i) { if(!animating) {handleMouseOut(d,i)}});

	// ADD ERROR ARROWS
	svg.append('g')
		.selectAll('line')
		.data(data)
		.join("line")
			.style("visibility", "hidden")
			.style("stroke", (d) => upOrDownColor(d))
			.style("stroke-width", 3)
			.attr("x1", (data, index) => (x(index) + x.bandwidth()/2))
			.attr("y1", d => y(d.est))
			.attr("x2", (data, index) => (x(index) + x.bandwidth()/2))
			.attr("y2", d => y(d.est))
			.attr("id", function(d,i){ 
				if(d.value > d.est) {
					return "arrowUp"+i;
				} else {
					return "arrowDown"+i;
				}
			})
			.attr('marker-end',	(data, index) => arrowHead(data, index))
			.on("mouseover", function(d, i) {	if(!animating) {handleMouseOver(d, i)}})
			.on("mouseout", function(d, i) { if(!animating) {handleMouseOut(d,i)}});


	animating = true;
	for (let i = 0; i < data.length; i++) {
		if (i != hintBarID) {
			if (i > hintBarID) {
				extraTime = i - 1;
			} else {
				extraTime = i;
			}
			setTimeout(function(event) {animateBar(data[i],i)}, (animationDuration + waitDuration*2) * extraTime);
		}
	}
	setTimeout(function() {
		animating = false;
		tool_tip.hide();
		document.getElementById("feedback").style.display="block";
		document.getElementById("feedback").innerHTML = "<i>Hover over the bars to review the data</i>";
	}, (animationDuration + waitDuration*2) * (data.length - 1) + 100);	

});

// ADD X-AXIS
function xAxis(g) {
	g.attr("transform", `translate(0,${height - margin.bottom})`)
		.call(d3.axisBottom(x).tickFormat(i => data[i].name))
		.attr("font-size", '18px')
		.attr("font-family", "'Libre Franklin', sans-serif")
}

// ADD Y-AXIS
function yAxis(g) {
	g.attr("transform", `translate(${margin.left}, 0)`)
		.call(d3.axisLeft(y).ticks(null, data.format))
		.attr("font-size", '18px')
		.attr("font-family", "'Libre Franklin', sans-serif");
}

function make_y_gridlines(g) {
  g.append("g")			
  .attr("class", "grid")
  .attr("transform", `translate(${margin.left}, 0)`)
  .call(d3.axisLeft(y).ticks(10)
      .tickSize(-width+margin.right*2)
      .tickFormat("")
  )
}

function upOrDownColor(d) {
	if(d.value > d.est) {
		return colorUp;
	} else {
		return colorDown;
	}
}

// Estimation functions
function brushmoveY() {
	var d0 = d3.event.selection.map(y.invert);
	var d = d3.select(this).select('.selection');
	
	if (initialized) {
		for (var i=0; i<data.length; i++) {
			if (data[i].name == d.data()[0].name) {
				d.datum().est= parseInt(d0[0]);
				handleMouseOverEst(d.data()[0], i);
			}
		}
	}
}

function startMoveY() {
	animating = true;

	var d = d3.select(this).select('.selection');
	if (initialized) {
		for (var i=0; i<data.length; i++) {
			if (data[i].name == d.data()[0].name)
				handleMouseOverEst(d.data()[0], i);
		}
	}
}

function endMoveY() {
	animating = false;

	var d = d3.select(this).select('.selection');
	if (initialized) {
		for (var i=0; i<data.length; i++) {
			if (data[i].name == d.data()[0].name) {
				if (!isMouseOnHandle(i, d3.mouse(this)))
					handleMouseOutEst(d.data()[0], i);
			}
		}
	}
}

// Check if mouse if still over handle to keep focus on bar or not
function isMouseOnHandle(i, mouseCoords) {
	var node = d3.select("#handle"+i).node();
	var xOK = (mouseCoords[0]-node.x.baseVal.value) > 0 && (mouseCoords[0]-node.x.baseVal.value) < node.width.baseVal.value;
	var yOK = (mouseCoords[1]-node.y.baseVal.value) > 0 && (mouseCoords[1]-node.y.baseVal.value) < node.height.baseVal.value
	return xOK && yOK;
}

function handleMouseOverEst(d, i) {
	if (i == hintBarID) {
		tool_tip_hint.show(data[i], document.getElementById("bar" + i));
	}

	for (j=0;j<data.length;j++) {
		if (i != j) {
			d3.select("#bar" + j).transition().style("fill", barHoverColor);
		}
	}
}
function handleMouseOutEst(d, i) {
	if (i == hintBarID) {
		tool_tip_hint.hide(data[i], document.getElementById("bar" + i));
	}

	for(j=0;j<data.length;j++){
		if (i != j) {
			d3.select("#bar" + j).transition().style("fill", barColor);
		}
	}
}

// Comparison functions
// Arrow heads (http://jsfiddle.net/igbatov/v0ekdzw1/)
function arrowHead(d, i) {
	svg.append("svg:defs").append("svg:marker")
		.style("visibility", "hidden")
		.attr("id", function(){ 
			if(d.value > d.est) {
				return "arrowHeadUp"+i;
			} else {
				return "arrowHeadDown"+i;
			}
		})
		.attr("refX", 11)
		.attr("refY", 6)
		.attr("markerWidth", 30)
		.attr("markerHeight", 30)
		.attr("markerUnits","userSpaceOnUse")
		.attr("orient", "auto-start-reverse")
		.append("path")
		.attr("id", function(){ 
			if(d.value > d.est) {
				return "arrowHeadFillUp"+i;
			} else {
				return "arrowHeadFillDown"+i;
			}
		})
		.attr("d", "M 0 0 12 6 0 12 3 6")
		.style("fill", upOrDownColor(d));

		if(d.value > d.est) {
			return "url(#arrowHeadUp"+i+")";
		} else {
			return "url(#arrowHeadDown"+i+")";
		}
}

// Add interactivity
function handleMouseOver(d, i, est = false) {
	if (i == hintBarID) {
		tool_tip_hint.show(data[i], document.getElementById("bar" + i));
	}

	if (est) {
		showEstimate = true;
	}

	tool_tip.show(d, document.getElementById("bar" + i));
	setFeedback(d, i);
	for(j=0;j<data.length;j++){
		if (i != j) {
			d3.select("#bar" + j).transition().style("fill", barHoverColor);
			d3.select("#barOutline" + j).transition().style("fill", barOutlineColorHover);
			d3.select("#barBorder" + j).transition().style("stroke", barHoverColor)
			d3.select("#lineUp" + j).transition().style("stroke", colorUpHover);
			d3.select("#lineDown" + j).transition().style("stroke", colorDownHover);
			d3.select("#arrowUp" + j).transition().style("stroke", colorUpHover)
			d3.select("#arrowDown" + j).transition().style("stroke", colorDownHover);
			d3.select("#arrowHeadFillUp" + j).transition().style("fill", colorUpHover);
			d3.select("#arrowHeadFillDown" + j).transition().style("fill", colorDownHover);
		}
	}
}

function handleMouseOut(d, i) {
	if (i == hintBarID) {
		tool_tip_hint.hide(data[i], document.getElementById("bar" + i));
	}

	tool_tip.hide(d, document.getElementById("bar" + i));
	setFeedback("", i);
	for(j=0;j<data.length;j++){
		if (i != j){
			d3.select("#bar" + j).transition().style("fill", barColor);
			d3.select("#barOutline" + j).transition().style("fill", barOutlineColor);
			d3.select("#barBorder" + j).transition().style("stroke", barColor)
			d3.select("#lineUp" + j).transition().style("stroke", colorUp);
			d3.select("#lineDown" + j).transition().style("stroke", colorDown);
			d3.select("#arrowUp" + j).transition().style("stroke", colorUp);
			d3.select("#arrowDown" + j).transition().style("stroke", colorDown);
			d3.select("#arrowHeadFillUp" + j).transition().style("fill", colorUp);
			d3.select("#arrowHeadFillDown" + j).transition().style("fill", colorDown);
		}
	}
}

// Add animation
// https://bl.ocks.org/guilhermesimoes/be6b8be8a3e8dc2b70e2
// https://www.d3-graph-gallery.com/graph/barplot_animation_start.html
function animateBar(d, i) {
	handleMouseOver(d, i, true);

	setTimeout(function() {

		d3.select("#lineUp" + i).transition("transition").style("visibility", "visible").duration(animationDuration);
		d3.select("#arrowUp" + i).transition("transition").style("visibility", "visible").attr("y2", d => y(d.value)).duration(animationDuration);

		d3.select("#lineDown" + i).transition("transition").style("visibility", "visible").duration(animationDuration);
		d3.select("#arrowDown" + i).transition("transition").style("visibility", "visible").attr("y2", d => y(d.value)).duration(animationDuration);
		d3.select("#bar" + i).transition("transition")
			.attr("height", function(d) { return height - y(d.value) - margin.bottom; })
			.duration(animationDuration)
			.attrTween('y', function (d, j) {
				return function (t) {
					var tooltipVal = d3.interpolate(d.est, d.value)(t);
					animateTooltip(i, tooltipVal);

					var ip_value = d3.interpolate(y(d.est), y(d.value))(t);
					var diff = Math.abs(ip_value - y(d.est));
					var arrowHeadShown = false;
					if (diff > 10 && !arrowHeadShown) {
						showArrowHead(i);
						arrowHeadShown = true;
					}
					return ip_value;
				};
		});

	}, waitDuration);
	setTimeout(function() {handleMouseOut(d, i);}, animationDuration + waitDuration*2 - 35);
}

function showArrowHead(i){
	d3.select("#arrowHeadFillDown" + i).transition("transition").style("visibility", "visible");
	d3.select("#arrowHeadFillUp" + i).transition("transition").style("visibility", "visible");
}

function animateTooltip(i,ip_value) {
	var temp = {name: "", value: Math.round(ip_value), est: 0};
	tool_tip.show(temp, document.getElementById("bar" + i));
}

// Text based feedback
function setFeedback(d, i) {
	if (d == "" || animating || i == hintBarID) {
		document.getElementById("feedback").innerHTML = "<b></b>";
	} else {
		var diff = Math.abs(d.value - d.est);
		if (d.est > d.value) {
			document.getElementById("feedback").innerHTML = "The correct value for " + d.name + " was <span style='color: " + colorDownText + ";'><b>" + d3.format(" ,")(diff) + " </b></span> "+ unitName +" <span style='color: " + colorDownText + ";'><b> lower </b></span> than you estimated.";
		} else {
			document.getElementById("feedback").innerHTML = "The correct value for " + d.name + " was <span style='color: " + colorUpText + ";'><b>" + d3.format(" ,")(diff) + " </b></span> "+ unitName +" <span style='color: " + colorUpText + ";'><b> higher </b></span> than you estimated.";
		}
	}	
}

function setData(initData, initVal, hintID) {
	dataTemp = [];
	for (let i = 0; i < initData.length; i++) {
		const e = initData[i];
		objTemp = {};
		objTemp.name = e.name;
		objTemp.value = parseInt(e.value);
		if (i == hintID) {
			objTemp.est = parseInt(e.value);
		} else {
			objTemp.est = parseInt(initVal);
		}
		dataTemp.push(objTemp);
	}
	return dataTemp;
}