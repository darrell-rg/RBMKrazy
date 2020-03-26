/*
This is the main code for drawing of guages

*/
"use strict";
function Gauge(placeholderName, configuration) {
	this.placeholderName = placeholderName;

	let self = this; // for internal d3 functions

	this.configure = function (configuration) {
		this.config = configuration;

		this.config.size = this.config.size * 0.9;

		this.config.raduis = this.config.size * 0.97 / 2;
		this.config.cx = this.config.size / 2;
		this.config.cy = this.config.size / 2;

		this.config.min = undefined != configuration.min ? configuration.min : 0;
		this.config.max = undefined != configuration.max ? configuration.max : 100;
		this.config.range = this.config.max - this.config.min;

		this.config.majorTicks = configuration.majorTicks || 5;
		this.config.minorTicks = configuration.minorTicks || 2;

		this.config.greenColor = configuration.greenColor || "#5eff64";
		this.config.yellowColor = configuration.yellowColor || "#FF9900";
		this.config.redColor = configuration.redColor || "#DC3912";
		this.config.trendColor = configuration.trendColor || "rgba(255, 220, 0, 0.5 )";

		this.config.transitionDuration = configuration.transitionDuration || 500;
	}

	this.render = function () {
		this.body = d3.select("#" + this.placeholderName)
			.append("svg:svg")
			.attr("class", "gauge")
			.attr("width", this.config.size)
			.attr("height", this.config.size);

		//outer rim of guage
		this.body.append("svg:circle")
			.attr("cx", this.config.cx)
			.attr("cy", this.config.cy)
			.attr("r", this.config.raduis)
			.style("fill", "#ccc")
			.style("stroke", "#000")
			.style("stroke-width", "0.5px");

		//main guage face
		this.body.append("svg:circle")
			.attr("cx", this.config.cx)
			.attr("cy", this.config.cy)
			.attr("r", 0.9 * this.config.raduis)
			.style("fill", "#EEE")
			.style("stroke", "#e0e0e0")
			.style("stroke-width", "2px");

		for (let index in this.config.greenZones) {
			this.drawBand(this.config.greenZones[index].from, this.config.greenZones[index].to, self.config.greenColor);
		}

		for (let index in this.config.yellowZones) {
			this.drawBand(this.config.yellowZones[index].from, this.config.yellowZones[index].to, self.config.yellowColor);
		}

		for (let index in this.config.redZones) {
			this.drawBand(this.config.redZones[index].from, this.config.redZones[index].to, self.config.redColor);
		}

		if (undefined != this.config.label) {
			let fontSize = Math.round(this.config.size / 9);
			this.body.append("svg:text")
				.attr("x", this.config.cx)
				.attr("y", this.config.cy / 2 + fontSize / 2)
				.attr("dy", fontSize / 2)
				.attr("text-anchor", "middle")
				.text(this.config.label)
				.style("font-size", fontSize + "px")
				.style("fill", "#333")
				.style("stroke-width", "0px");
		}

		let fontSize = Math.round(this.config.size / 16);
		let majorDelta = this.config.range / (this.config.majorTicks - 1);
		for (let major = this.config.min; major <= this.config.max; major += majorDelta) {
			let minorDelta = majorDelta / this.config.minorTicks;
			for (let minor = major + minorDelta; minor < Math.min(major + majorDelta, this.config.max); minor += minorDelta) {
				let point1 = this.valueToPoint(minor, 0.75);
				let point2 = this.valueToPoint(minor, 0.85);

				this.body.append("svg:line")
					.attr("x1", point1.x)
					.attr("y1", point1.y)
					.attr("x2", point2.x)
					.attr("y2", point2.y)
					.style("stroke", "#666")
					.style("stroke-width", "1px");
			}

			let point1 = this.valueToPoint(major, 0.7);
			let point2 = this.valueToPoint(major, 0.85);

			this.body.append("svg:line")
				.attr("x1", point1.x)
				.attr("y1", point1.y)
				.attr("x2", point2.x)
				.attr("y2", point2.y)
				.style("stroke", "#333")
				.style("stroke-width", "2px");

			if (major == this.config.min || major == this.config.max) {
				let point = this.valueToPoint(major, 0.63);

				this.body.append("svg:text")
					.attr("x", point.x)
					.attr("y", point.y)
					.attr("dy", fontSize / 3)
					.attr("text-anchor", major == this.config.min ? "start" : "end")
					.text(major)
					.style("font-size", fontSize + "px")
					.style("fill", "#333")
					.style("stroke-width", "0px");
			}
		}

		let pointerContainer = this.body.append("svg:g").attr("class", "pointerContainer");

		let midValue = (this.config.min + this.config.max) / 2;

		let pointerPath = this.buildPointerPath(midValue);

		let pointerLine = d3.line()
			.x(function (d) { return d.x })
			.y(function (d) { return d.y });
		//.interpolate("basis");  //this was from d3 verison 3 and has not been updated, may be broken

		pointerContainer.selectAll("path")
			.data([pointerPath])
			.enter()
			.append("svg:path")
			.attr("d", pointerLine)
			.style("fill", "#dc3912")
			.style("stroke", "#c63310")
			.style("fill-opacity", 0.7)

		pointerContainer.append("svg:circle")
			.attr("cx", this.config.cx)
			.attr("cy", this.config.cy)
			.attr("r", 0.12 * this.config.raduis)
			.style("fill", this.config.trendColor)  //#4684EE
			.style("stroke", "#666")
			.style("opacity", 1);

		fontSize = Math.round(this.config.size / 10);
		pointerContainer.selectAll("text")
			.data([midValue])
			.enter()
			.append("svg:text")
			.attr("x", this.config.cx)
			.attr("y", this.config.size - this.config.cy / 4 - fontSize)
			.attr("dy", fontSize / 2)
			.attr("text-anchor", "middle")
			.style("font-size", fontSize + "px")
			.style("fill", "#000")
			.style("stroke-width", "0px");

		this.redraw(this.config.min, 0);
	}

	this.buildPointerPath = function (value) {
		let delta = this.config.range / 13;

		let head = valueToPoint(value, 0.85);
		let head1 = valueToPoint(value - delta, 0.12);
		let head2 = valueToPoint(value + delta, 0.12);

		let tailValue = value - (this.config.range * (1 / (270 / 360)) / 2);
		let tail = valueToPoint(tailValue, 0.28);
		let tail1 = valueToPoint(tailValue - delta, 0.12);
		let tail2 = valueToPoint(tailValue + delta, 0.12);

		return [head, head1, tail2, tail, tail1, head2, head];

		function valueToPoint(value, factor) {
			let point = self.valueToPoint(value, factor);
			point.x -= self.config.cx;
			point.y -= self.config.cy;
			return point;
		}
	}

	this.drawBand = function (start, end, color) {
		if (0 >= end - start) return;

		this.body.append("svg:path")
			.style("fill", color)
			.attr("d", d3.arc()
				.startAngle(this.valueToRadians(start))
				.endAngle(this.valueToRadians(end))
				.innerRadius(0.65 * this.config.raduis)
				.outerRadius(0.85 * this.config.raduis))
			.attr("transform", function () { return "translate(" + self.config.cx + ", " + self.config.cy + ") rotate(270)" });
	}

	this.redraw = function (value, transitionDuration) {
		let pointerContainer = this.body.select(".pointerContainer");

		if ((Math.abs(this.config.min - this.config.max) < 1)) {
			let f= parseFloat(value);
			pointerContainer.selectAll("text").text(f.toPrecision(4).substr(0,5));
		} else {
			pointerContainer.selectAll("text").text(Math.round(value));
		}
		

		let pointer = pointerContainer.selectAll("path");
		pointer.transition()
			.duration(undefined != transitionDuration ? transitionDuration : this.config.transitionDuration)
			//.delay(0)
			//.ease("linear")
			//.attr("transform", function(d) 
			.attrTween("transform", function () {
				let pointerValue = value;
				if (value > self.config.max) pointerValue = self.config.max + 0.02 * self.config.range;
				else if (value < self.config.min) pointerValue = self.config.min - 0.02 * self.config.range;
				let targetRotation = (self.valueToDegrees(pointerValue) - 90);
				let currentRotation = self._currentRotation || targetRotation;
				self._currentRotation = targetRotation;

				return function (step) {
					let rotation = currentRotation + (targetRotation - currentRotation) * step;
					return "translate(" + self.config.cx + ", " + self.config.cy + ") rotate(" + rotation + ")";
				}
			});
	}

	this.valueToDegrees = function (value) {
		// thanks @closealert
		//return value / this.config.range * 270 - 45;
		return value / this.config.range * 270 - (this.config.min / this.config.range * 270 + 45);
	}

	this.valueToRadians = function (value) {
		return this.valueToDegrees(value) * Math.PI / 180;
	}

	this.valueToPoint = function (value, factor) {
		return {
			x: this.config.cx - this.config.raduis * factor * Math.cos(this.valueToRadians(value)),
			y: this.config.cy - this.config.raduis * factor * Math.sin(this.valueToRadians(value))
		};
	}

	// initialization
	this.configure(configuration);
}



function TrendPlot(ctx, configuration, fps = 4) {
	this.ctx = ctx;
	this.fps = fps;
	let self = this; // for internal d3 functions
	let HEIGHT = ctx.canvas.clientHeight;
	let WIDTH = ctx.canvas.clientWidth;
	let text_x = 2;
	let label_max_x = 40;
	let text_height = 8;
	let pip_height = 1;
	let last_line_y = {};
	let frame_number = 0;
	let tick_interval = 60;//seconds between vertical bars

	this.configure = function (configuration) {
		this.config = configuration;

		this.config.padding = 5;
		this.config.backgroundColor = '#fff';
	}

	this.advanceTrend = function () {
		if (frame_number % (this.fps * tick_interval) == 0) {
			let now = new Date();
			let text_y = HEIGHT;

			this.ctx.strokeStyle = "#BBB";
			this.ctx.beginPath();
			this.ctx.moveTo(label_max_x + 1, 0);
			this.ctx.lineTo(label_max_x + 1, HEIGHT - 10);
			this.ctx.stroke();

			this.ctx.strokeStyle = "#000";
			this.ctx.fillStyle = "#000";
			this.ctx.font = '8px serif';
			this.ctx.fillText(now.toLocaleTimeString(), label_max_x, text_y);

		}

		let imgData = ctx.getImageData(label_max_x, 0, WIDTH - label_max_x, HEIGHT);
		this.ctx.fillStyle = this.config.backgroundColor;
		this.ctx.fillRect(0, 0, WIDTH, HEIGHT);
		this.ctx.putImageData(imgData, label_max_x + 1, 0);
		frame_number++;
	}

	this.clearTrend = function () {
		this.ctx.clearRect(0, 0, WIDTH, HEIGHT);
		this.ctx.fillStyle = this.config.backgroundColor;
		this.ctx.fillRect(0, 0, WIDTH, HEIGHT)
	}

	this.plotTrend = function (value, label = "Neu", color = "rgba(255, 220, 0, 0.5 )") {

		let h = HEIGHT - (this.config.padding * 2);
		let text_y = (h - (value * h)) + this.config.padding * 1.5; //+y is down
		let line_y = text_y - (text_height / 2)
		if (!last_line_y[label]) {
			last_line_y[label] = line_y;
		}


		this.ctx.fillStyle = color;
		this.ctx.strokeStyle = color;

		//we make a vertical line so there are no gaps when trend changes by more then one px
		this.ctx.fillRect(label_max_x - 1, line_y, 2, pip_height);
		this.ctx.beginPath();
		this.ctx.moveTo(label_max_x + 1, line_y);
		this.ctx.lineTo(label_max_x + 1, last_line_y[label]);
		this.ctx.stroke();

		this.ctx.font = '8px serif';
		this.ctx.fillText(label, text_x, text_y);
		//store prevous line_y for big jumps
		last_line_y[label] = line_y;
	}

	// initialization
	this.configure(configuration);

}
