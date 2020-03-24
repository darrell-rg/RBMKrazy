/*
This is the main code for the simulation and rendering

*/
"use strict";
let FPS = 60;

let WALL_THICKNESS = 5;
let FUEL_SIZE = 60;
let WALL_CATAGORY = 0x0001;
let FUEL_FRICTION = 0.2; //defaut 0.1
let FUEL_DENSITY = 0.0001; //default 0.001 
let FUEL_RESTITUTION = 0.8; //default 0
let FUEL_FRICTION_STATIC = 40.5//defult 0.5;
let FUEL_CATAGORY = Matter.Body.nextCategory();
let NEUTRON_CATAGORY = Matter.Body.nextCategory();
let SPRITE_SCALE = 0.56;  //size to draw element sprite

let NEUTRON_INITIAL_V = 15; //how fast nutrons move
let NEUTRON_INITIAL_R = 2; //larger value makes neutrons live longer
let NEUTRON_DEATH_RATE = 0.991; //smaller numbers make neutrons die faster, very sensitive
let MIN_NEUTRON_SPEED = 0.5;
let MAX_NEXT_GEN_LEN = 1024;
let MAX_SIMULATED_NEUTRONS = 20480; //how many are simualted
let MAX_DRAWN_NEUTRONS = 4096; // how many actualy drawn
let CROSSSECTION_SCALE = 0.9;  //increase to make things go out of control faster
let FUEL_EXPLODE_TEMP = 1000;  //temp at which a fuel rod will pop
let HEAT_PER_FISION = 0.5;
let POWER_SCALE = 8 * FPS;
let U_SPECIFIC_HEAT = 116; //J/(kg K)
let U_THERMAL_CONDUCTIVITY = 116; //W/(m K)
let HEAT_TRANSFER_COEFFICIENT = 2e-6 / FPS; //increase this to make cooling more effective
let PLANT_POWER_USE = 50; //how much power consumed by the plant
let PRICE_PER_KWH = 0.1;  //price to sell or buy power

let canvas = document.getElementById("gameCanvas");
let context = canvas.getContext("2d");
let HEIGHT = context.canvas.clientHeight;
let WIDTH = context.canvas.clientWidth;

let tempCanvas = document.getElementById("tempCanvas");
let tempContext = tempCanvas.getContext("2d", { alpha: false });  //,{ alpha: false } is supposed to be faster but actually seems slower
tempCanvas.width = FUEL_SIZE * 4;
tempCanvas.height = FUEL_SIZE * 4;


let heatCanvas = document.getElementById("heatMapCanvas");
let heatContext = heatCanvas.getContext("2d");  //,{ alpha: false } is supposed to be faster but actually seems slower
heatCanvas.width = 275;//FUEL_SIZE * 5;
heatCanvas.height = 175;


let trendCanvas = document.getElementById("trendCanvas");
let trendContext = trendCanvas.getContext("2d");  //,{ alpha: false } is supposed to be faster but actually seems slower
trendCanvas.width = 275;//FUEL_SIZE * 5.5;
trendCanvas.height = 250;//FUEL_SIZE * 5;

//diagnostic info
let frame_number = 0;
let t0 = 1, t1 = 1;
let avg_tick_time = 66.0;
let avg_draw_time = 66.0;
let avg_physics_time = 66.0;
let Keff = 1.00;

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    HEIGHT = context.canvas.clientHeight;
    WIDTH = context.canvas.clientWidth;
    // CONTEXT.lineWidth = PARAMETERS.LINE_WIDTH;
    // CONTEXT.strokeStyle = randomColor();
}
resizeCanvas();

// engine
let engine = Matter.Engine.create(
    {
        enableSleeping: false,
    }

);
let runner = Matter.Runner.create();

// render
let render = Matter.Render.create({
    canvas: canvas,
    engine: engine,
    options: {
        width: WIDTH,
        height: HEIGHT,
        wireframes: false,
        showDebug: false,
        showSleeping: false,
        showIds: false,
        background: '#000000'
    }
});

// add mouse control
// todo: disable sleep when mouse is dragging
let mouse = Matter.Mouse.create(render.canvas);
let mouseConstraint = Matter.MouseConstraint.create(engine, {
    mouse: mouse,
    constraint: {
        stiffness: 0.2,
        render: {
            visible: false
        }
    }
});

Matter.World.add(engine.world, mouseConstraint);
// keep the mouse in sync with rendering
render.mouse = mouse;



// matter.js has a built in random range function, but it is deterministic
function rand(min, max) {
    return Math.random() * (max - min) + min;
}

function wall(x, y, width, height, angle = 0) {
    return Matter.Bodies.rectangle(x, y, width, height, {
        isStatic: true,
        restitution: 0.01,
        friction: FUEL_FRICTION,
        frictionStatic: FUEL_FRICTION_STATIC,
        angle: angle,
        label: 'wall',
        collisionFilter: {
            category: WALL_CATAGORY
        },
        render: {
            fillStyle: '#868e96'
        }
    });
}


function make_fuel(x, y, width = FUEL_SIZE, height = FUEL_SIZE, angle = 0) {
    return Matter.Bodies.rectangle(x, y, width, height, {
        isStatic: false,
        angle: angle,
        restitution: FUEL_RESTITUTION,
        friction: FUEL_FRICTION,
        density: FUEL_DENSITY,
        frictionStatic: FUEL_FRICTION_STATIC,
        label: 'fuel',
        render: {
            fillStyle: '#868e96',
            lineWidth: 1,
            sprite: {
                texture: './img/U.png',
                xScale: SPRITE_SCALE,
                yScale: SPRITE_SCALE,
            }
        },
        plugin: {
            r: FUEL_SIZE / 2,
            crossSection: 0.04 * CROSSSECTION_SCALE,
            temperature: 20,
            spontaneousFisionRate: 0.01,
        }

    });
}

function make_moderator(x, y, width = FUEL_SIZE, height = FUEL_SIZE, angle = 0) {
    return Matter.Bodies.rectangle(x, y, width, height, {
        isStatic: false,
        angle: angle,
        restitution: FUEL_RESTITUTION,
        friction: FUEL_FRICTION,
        frictionStatic: FUEL_FRICTION_STATIC,
        density: FUEL_DENSITY * 0.3,
        label: 'moderator',
        render: {
            fillStyle: '#268ef6',
            lineWidth: 1,
            sprite: {
                texture: './img/C.png',
                xScale: SPRITE_SCALE,
                yScale: SPRITE_SCALE,
            }
        },
        plugin: {
            r: FUEL_SIZE / 2,
            crossSection: 0.5 * CROSSSECTION_SCALE,
            temperature: 20,
            spontaneousFisionRate: 0,
        }

    });
}

function make_reflector(x, y, width = FUEL_SIZE, height = FUEL_SIZE, angle = 0) {
    return Matter.Bodies.rectangle(x, y, width, height, {
        isStatic: false,
        angle: angle,
        restitution: FUEL_RESTITUTION,
        friction: FUEL_FRICTION,
        frictionStatic: FUEL_FRICTION_STATIC,
        density: FUEL_DENSITY * 0.2,
        label: 'reflector',
        render: {
            fillStyle: '#268ef6',
            lineWidth: 1,
            sprite: {
                texture: './img/Be.png',
                xScale: SPRITE_SCALE,
                yScale: SPRITE_SCALE,
            }
        },
        plugin: {
            r: FUEL_SIZE / 2,
            crossSection: 0.5 * CROSSSECTION_SCALE,
            temperature: 20,
            spontaneousFisionRate: 0,
        }

    });
}


function make_poison(x, y, width = FUEL_SIZE, height = FUEL_SIZE, angle = 0) {
    return Matter.Bodies.rectangle(x, y, width, height, {
        isStatic: false,
        angle: angle,
        restitution: FUEL_RESTITUTION,
        friction: FUEL_FRICTION,
        frictionStatic: FUEL_FRICTION_STATIC,
        density: FUEL_DENSITY * .25,
        label: 'poison',
        render: {
            fillStyle: '#268ef6',
            lineWidth: 1,
            sprite: {
                texture: './img/B.png',
                xScale: SPRITE_SCALE,
                yScale: SPRITE_SCALE,
            }
        },
        plugin: {
            r: FUEL_SIZE / 2,
            crossSection: 0.09 * CROSSSECTION_SCALE,
            temperature: 20,
            spontaneousFisionRate: 0,
        }

    });
}

function getRandNeutron(x, y, last_id = null) {
    return {
        x: x,//Math.random() * WIDTH,
        y: y,// Math.random() * HEIGHT,
        t: Math.random() * 2 * Math.PI,
        v: NEUTRON_INITIAL_V,
        r: NEUTRON_INITIAL_R,
        lastInteratedWith: last_id
    };
}


//return a new empty simulation state object
function getEmptyState() {
    let state = { //holds the current state of the game
        neutrons: []
        , fuels: []
        , moderators: []
        , reflectors: []
        , core_materials: []
        , poisons: []
        , avg_rads: 1
        , avg_power: 1
        , avg_n_speed: 1
        , total_births: 1
        , total_deaths: 1
        , curently_alive: 1
        , coolent_temperature_in: 20
        , coolent_temperature_out: 20
        , startTime: new Date()
        , money: 0
    }
    return state;
}


let state = getEmptyState();


function startSim() {
    //Startup the sim
    Matter.Render.run(render);
    Matter.Runner.run(runner, engine);
}

function stopSim() {
    Matter.Render.stop(render);
    Matter.Runner.stop(runner);
}

// events
//Matter.Events.on(engine, 'collisionStart', lightPeg);
Matter.Events.on(render, 'beforeRender', beforeRenderHandler);
Matter.Events.on(render, 'afterRender', afterRenderHandler);

function inRange(neutron, fuel_rod) {
    let x = neutron.x - fuel_rod.position.x,
        y = neutron.y - fuel_rod.position.y,
        l = Math.sqrt(x * x + y * y),
        r = fuel_rod.plugin.r - 1;
    return l < r;
}

function shouldBeAbsorbed(neutron) {
    for (const p of state.poisons) {
        //roll for fision
        if (inRange(neutron, p) && Math.random() < p.plugin.crossSection) {
            return p;
        }
    }
    return false;
}

function shouldBeReflected(neutron) {
    for (const reflector of state.reflectors) {
        //roll for fision
        if (neutron.lastInteratedWith === reflector.id) {
            return false;
        }
        if (inRange(neutron, reflector) && Math.random() < reflector.plugin.crossSection) {
            return reflector;
        }
    }
    return false;
}

function shouldBeModerated(neutron) {
    for (const moderator of state.moderators) {
        //roll for fision
        if (neutron.lastInteratedWith === moderator.id) {
            return false;
        }
        if (inRange(neutron, moderator) && Math.random() < moderator.plugin.crossSection) {
            return moderator;
        }
    }
    return false;
}

function shouldSplit(neutron) {
    for (let fuel_rod of state.fuels) {
        if (neutron.lastInteratedWith === fuel_rod.id) {
            return false;
        }
        //roll for fision
        let doplar_reduction = ((5000 - fuel_rod.plugin.temperature) / 5000); //make this number bigger to reduce effect of doplar_reduction
        //let doplar_reduction = 1;
        if (inRange(neutron, fuel_rod) && Math.random() < fuel_rod.plugin.crossSection * doplar_reduction) {
            return fuel_rod;
        }
    }
    return false;
}

function get_transfered_heat(material, mcp_speed) {
    //COOLING_RATE * mcp_speed * (1 + Math.log(m.plugin.temperature));
    //Q=hA(t1-t2)
    let t2 = state.coolent_temperature_in + 273.15;
    let t1 = material.plugin.temperature + 273.15;
    let h = HEAT_TRANSFER_COEFFICIENT * mcp_speed;
    let A = material.area
    let Q = h * A * (t1 - t2);

    if (Math.abs(Q) > 9999) {
        console.log("Q range error", Q);
        return 0;
    }

    return Q;

}

function tick_neutrons(neutrons) {
    let next_gen = [];
    let deaths = 0;
    let births = 0;
    let new_rads = 0;
    let new_power = -1*PLANT_POWER_USE;
    let new_speed = 1;
    let mcp_speed = mcp_slider.value / 100.0;

    //process heat for non-fuels
    for (let m of state.core_materials) {
        //let Q = get_transfered_heat(m,mcp_speed);

        //m.plugin.temperature -= (Q / (U_SPECIFIC_HEAT/(m.mass*1000)));
        //new_power += Q;

    }

    for (let fuel_rod of state.fuels) {
        let Q = get_transfered_heat(fuel_rod, mcp_speed);
        //dT = Q/(m*cp) 
        if (fuel_rod.plugin.temperature > FUEL_EXPLODE_TEMP) {
            //overheated fuel rods release a lot of rads!
            new_rads += 2;
        }

        fuel_rod.plugin.temperature -= (Q / (U_SPECIFIC_HEAT / (fuel_rod.mass * 1000)));
        new_power += Q * POWER_SCALE;

        //roll for spontaneousFision
        if (Math.random() < fuel_rod.plugin.spontaneousFisionRate) {
            fuel_rod.plugin.temperature += HEAT_PER_FISION;
            let n = getRandNeutron(fuel_rod.position.x, fuel_rod.position.y, fuel_rod.id);
            births++;
            next_gen.push(n);
        }
    }

    //console.log(new_power);

    function process_neutron(n) {
        //d.t += Math.random()*.5 - .25;
        n.x += Math.cos(n.t) * n.v;
        n.y += Math.sin(n.t) * n.v;
        n.r *= NEUTRON_DEATH_RATE;
        //nuetrons die if they get too small(old)
        if (n.r < 0.5) {
            deaths++;
            return null;
        }
        //neutrons die if they escape canvas
        if (n.x < 0 || n.x > WIDTH) {
            deaths++;
            new_rads++; //radition made it off site
            return null;
        }
        if (n.y < 0 || n.y > HEIGHT) {
            deaths++;
            new_rads++; //radition made it off site
            return null;
        }
        let p = shouldBeAbsorbed(n);
        if (p) {
            p.plugin.temperature += HEAT_PER_FISION;
            deaths++;
            return null;
        }

        let m = shouldBeModerated(n);
        if (m) {
            //m.plugin.temperature += HEAT_PER_FISION/2;
            n.lastInteratedWith = m.id;
            n.v *= 0.5;
            if (n.v < MIN_NEUTRON_SPEED) {
                n.v = MIN_NEUTRON_SPEED;
                //TODO: MIN_NEUTRON_SPEED gets higher with tempreture
            }
            return n;
        }

        let sr = shouldBeReflected(n);
        if (sr) {
            n.t += Math.PI + (Math.random() * 0.1);
            n.t = n.t % (Math.PI * 2);
            n.lastInteratedWith = sr.id;
            return n;
        }
        //check if nuetrons hit fuel and split
        let fuel_rod = shouldSplit(n);
        if (fuel_rod && next_gen.length < MAX_NEXT_GEN_LEN) {
            fuel_rod.plugin.temperature += HEAT_PER_FISION;
            n.lastInteratedWith = fuel_rod.id;
            //reset speed and lifetime for parent neutron
            n.r = NEUTRON_INITIAL_R; //* 1.07;
            n.v = NEUTRON_INITIAL_V;
            n.t = (n.t + Math.random()) % (Math.PI * 2);;
            //split into two, make child and parent go random dir
            let next = getRandNeutron(n.x, n.y, fuel_rod.id);
            births++;
            next_gen.push(next);
        }
        return n;
    }

    let total_n_speed = 0;
    let new_neutrons = neutrons.map(process_neutron)
        .concat(next_gen)
        .filter(function (n) {
            if (n !== null) {
                total_n_speed += n.v;
            }
            return n !== null;
        });



    //limit number of neutrons for reasonable perf 
    if (new_neutrons.length > MAX_SIMULATED_NEUTRONS) {
        deaths += new_neutrons.length - MAX_SIMULATED_NEUTRONS;
        new_neutrons.length = MAX_SIMULATED_NEUTRONS;
    }


    state.total_births += births;
    state.total_deaths += deaths;
    state.curently_alive = state.total_births - state.total_deaths;
    state.avg_rads = ((state.avg_rads * 29) + new_rads) / 30.0; //smooth rads
    state.avg_power = ((state.avg_power * 9) + new_power) / 10.0; //smooth power

    if (new_neutrons.length > 0) {
        new_speed = (total_n_speed + 0.1) / new_neutrons.length;
        state.avg_n_speed = ((state.avg_n_speed * 29) + new_speed) / 30.0;
    }
    return new_neutrons;
}

//draw neutrons
function draw_neutrons(neutrons) {
    //it is faster to set the fillStyle only once
    context.fillStyle = "rgba(255, 220, 0, 0.5 )";

    let r = 3;
    let max_to_draw = MAX_DRAWN_NEUTRONS;
    if (max_to_draw > neutrons.length)
        max_to_draw = neutrons.length;
    for (let i = 0; i < max_to_draw; i++) {
        // r = n.r * NEUTRON_SCALE;
        // if (r > (FUEL_SIZE / 2)) {
        //     r = FUEL_SIZE / 2;
        // }
        context.beginPath();
        context.arc(neutrons[i].x, neutrons[i].y, r, 0, 2 * Math.PI);
        context.fill();
    };
}


//draw neutrons with tempcanvas
//not much faster then direct draw
//TODO: try using imgdata 
function draw_neutrons_fast(neutrons) {
    tempContext.clearRect(0, 0, FUEL_SIZE / 4, FUEL_SIZE / 4);
    tempContext.fillStyle = "rgba(255, 220, 0, 0.5 )";

    tempContext.beginPath()
    tempContext.arc(5, 5, 5, 0, 2 * Math.PI);
    tempContext.fill();

    for (const n of neutrons) {
        context.drawImage(tempCanvas, n.x - FUEL_SIZE / 8, n.y - FUEL_SIZE / 8);
    }
}


let stats = {
    neutron_count: 1,
    mean_fuel_temp: 1,
    time: 1,
}

function get_stats() {
    let sum = 0;//= fuels.reduce((previous, current) => current.plugin.temperature += previous);

    let max_temp = 0;
    for (const fuel_rod of state.fuels) {
        sum += fuel_rod.plugin.temperature;
        if (max_temp < fuel_rod.plugin.temperature) {
            max_temp = fuel_rod.plugin.temperature;
        }
    }

    let avg_temp = sum / state.fuels.length;

    let stats = {
        neutron_count: state.neutrons.length,
        mean_fuel_temp: avg_temp,
        max_fuel_temp: max_temp,
        time: performance.now()
    }
    if(!stats.neutron_count)
    {
        stats.neutron_count = 0
    }

    return stats;
}


function beforeRenderHandler() {

    //clear the main canvas
    context.clearRect(0, 0, WIDTH, HEIGHT);
    heatContext.fillStyle = "rgba(0,0,0,0.1 )";
    heatContext.filter = 'blur(4px)';
    heatContext.fillRect(0,0,300,3000);
    //draw heat circles behind fuel
    state.fuels.forEach(function (fuel_rod) {
        let r = (FUEL_SIZE / 2) + 4;
        let fill_color = "255, 0, 0,";
        //fuel gets bigger and "explodes" if tempreture gets above a threshold
        if (fuel_rod.plugin.temperature > FUEL_EXPLODE_TEMP && fuel_rod.area <= FUEL_SIZE * FUEL_SIZE) {
            Matter.Body.scale(fuel_rod, 2, 2);
            fill_color = "0, 0, 255,";
            r = r * 3;
        }
        else if (fuel_rod.area > FUEL_SIZE * FUEL_SIZE) {
            Matter.Body.scale(fuel_rod, 0.99, 0.99);
            fill_color = "0, 0, 250,";
            r = r * 1.5;
        }
        let x = fuel_rod.position.x,
            y = fuel_rod.position.y,
            a = fuel_rod.plugin.temperature / (FUEL_EXPLODE_TEMP * 0.8);
        context.beginPath()
        context.arc(x, y, r, 0, 2 * Math.PI);
        context.fillStyle = "rgba(" + fill_color + a + ")";
        context.fill();

        //draw heatmap 
        //let heatScale = 250.0/WIDTH;
        let heatScale = 175.0/HEIGHT;

        // Create gradient
        r=r*heatScale;
        x=x*heatScale;
        y=y*heatScale;
        
        //reateRadialGradient(x,y,r,x1,y1,r1) - creates a radial/circular gradient
        let grd = heatContext.createRadialGradient(x, y, r/4, x, y, r*1.5);
        //let color = d3.interpolateInferno(fuel_rod.plugin.temperature / FUEL_EXPLODE_TEMP);
        //grd.addColorStop(0, color+"FF");
        grd.addColorStop(0, "rgba( 255, 0, 0, " + a + ")");
        grd.addColorStop(1, "rgba( 0,0,200,"+ a/6 + ")");
        heatContext.beginPath();
        // Fill with gradient
        heatContext.fillStyle = grd;
        heatContext.arc(x, y, r*1.5, 0, 2 * Math.PI);
        //heatContext.fillStyle = "rgba(" + fill_color + a + ")";
        heatContext.fill();
    });

    t0 = performance.now();

}


function afterRenderHandler() {

    let now = new Date();
    let elapsed = (now - state.startTime) / 1000;

    t1 = performance.now();
    avg_physics_time = ((avg_physics_time * 29) + (t1 - t0)) / 30.0;

    t0 = performance.now();
    state.neutrons = tick_neutrons(state.neutrons);
    t1 = performance.now();
    avg_tick_time = ((avg_tick_time * 29) + (t1 - t0)) / 30.0;

    t0 = performance.now();
    draw_neutrons(state.neutrons);
    t1 = performance.now();
    avg_draw_time = ((avg_draw_time * 29) + (t1 - t0)) / 30.0;

    state.money = state.money + (state.avg_power * (PRICE_PER_KWH/FPS));

    let prev_stats = stats;
    stats = get_stats();
    
    //Keff can be expanded with inverse log 
    // k = 1/Math.log(Keff)
    let new_Keff = 1.0;
    if (prev_stats.neutron_count > 0){
        new_Keff = stats.neutron_count / prev_stats.neutron_count;
    }
    if (Math.abs(prev_stats.neutron_count -  stats.neutron_count) < 2){
        new_Keff = 1.0;
    }
    //Keff needs a lot of smoothing to be usefull
    Keff = ((Keff * 199.0) + new_Keff ) / 200.0;


    document.getElementById("meanFuelTemp" + "GaugeContainer").dataset.value = stats.mean_fuel_temp;
    document.getElementById("maxFuelTemp" + "GaugeContainer").dataset.value = stats.max_fuel_temp;
    document.getElementById("neutron_count" + "GaugeContainer").dataset.value = stats.neutron_count;
    //document.getElementById("neutron_speed" + "GaugeContainer").dataset.value = state.avg_n_speed;
    document.getElementById("power" + "GaugeContainer").dataset.value = state.avg_power;
    document.getElementById("rad" + "GaugeContainer").dataset.value = state.avg_rads;
    document.getElementById("Keff" + "GaugeContainer").dataset.value = Keff;
    

    document.getElementById("perf").innerHTML = "Elapsed: " + elapsed.toPrecision(5).substr(0,6) + " s"
        + "<br> simulating: " + state.curently_alive.toPrecision(5).substr(0,6) + " N"
        + "<br> N tick time: " + avg_tick_time.toPrecision(5).substr(0,6) + "ms"
        + "<br> N draw time: " + avg_draw_time.toPrecision(5).substr(0,6) + "ms"
        + "<br>pyhsics tick+draw: " + avg_physics_time.toPrecision(5).substr(0,6) + "ms";
    frame_number += 1;
    checkGameOver();
}


function checkGameOver() {
    if (state.avg_rads > 30) {
        showGameOver("Too many rads emmited offsite. The NRC shut you down!<br> You did not get a very favorable review in the IAEA report...");
    }
    if (stats.mean_fuel_temp > 900) {
        showGameOver("A meltdown ‽  How did you possibly manage to melt down an RBMK reactor? <br> Now this browser tab won't be usable for 1000 years!");
    }
}
