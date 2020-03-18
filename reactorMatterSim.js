/*
This is the main code for the simulation and rendering

*/
"use strict";
let canvas = document.getElementById("gameCanvas");
let context = canvas.getContext("2d");
let HEIGHT = context.canvas.clientHeight;
let WIDTH = context.canvas.clientWidth;

let frame_number = 0;

let FPS = 60;

let WALL_THICKNESS = 5;
let FUEL_SIZE = 50;
let WALL_CATAGORY = 0x0001;
let FUEL_FRICTION = 0.2; //defaut 0.1
let FUEL_DENSITY = 0.0001; //default 0.001 
let FUEL_RESTITUTION = 0.8; //default 0
let FUEL_FRICTION_STATIC = 40.5//defult 0.5;
let FUEL_CATAGORY = Matter.Body.nextCategory();
let NEUTRON_CATAGORY = Matter.Body.nextCategory();
let SPRITE_SCALE = 0.48;  //size to draw element sprite

let NEUTRON_INITIAL_V = 15; //how fast nutrons move
let NEUTRON_INITIAL_R = 2; //larger value makes neutrons live longer
let NEUTRON_DEATH_RATE = 0.991; //smaller numbers make neutrons die faster, very sensitive
let MIN_NEUTRON_SPEED = 0.5;
let MAX_NEXT_GEN_LEN = 1024;
let MAX_SIMULATED_NEUTRONS = 20480; //how many are simualted
let MAX_DRAWN_NEUTRONS = 4096; // how many actualy drawn
let CROSSSECTION_SCALE = 0.5;  //increase to things go out of control faster
let FUEL_EXPLODE_TEMP = 1000;  //temp at which a fuel rod will pop


let HEAT_PER_FISION = 0.5; 
let POWER_SCALE = 8*FPS;

let U_SPECIFIC_HEAT = 116; //J/(kg K)
let U_THERMAL_CONDUCTIVITY = 116; //W/(m K)

let HEAT_TRANSFER_COEFFICIENT = 2e-6 / FPS; //increase this to make cooling more effective

let tempCanvas = document.getElementById("tempCanvas");
let tempContext = tempCanvas.getContext("2d", { alpha: false });  //,{ alpha: false } is supposed to be faster but actually seems slower
tempCanvas.width = FUEL_SIZE / 4;
tempCanvas.height = FUEL_SIZE / 4;


let trendCanvas = document.getElementById("trendCanvas");
let trendContext = trendCanvas.getContext("2d");  //,{ alpha: false } is supposed to be faster but actually seems slower
trendCanvas.width = FUEL_SIZE * 5.5;
trendCanvas.height = FUEL_SIZE * 5;

let t0 = 1, t1 = 1;
let avg_tick_time = 66.0;
let avg_draw_time = 66.0;
let avg_physics_time = 66.0;
let worth = 1.0;

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

let stats = {
    neutron_count: 1,
    mean_fuel_temp: 1,
    time: 1,
}

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
            crossSection: 0.5,
            temperature: 20,
            spontaneousFisionRate: 0.1,
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
            crossSection: 0.5,
            temperature: 20,
            spontaneousFisionRate: 0.1,
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
            crossSection: 0.02,
            temperature: 20,
            spontaneousFisionRate: 0.1,
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

let neutrons = []; //d3.range(10).map(getRandNeutron);
let fuels = [];
let moderators = [];
let reflectors = [];
let core_materials = [];
let poisons = [];
let avg_rads = 1;
let avg_power = 1;
let avg_n_speed = 1;
let total_births = 1;
let total_deaths = 1;
let curently_alive = 1;
let coolent_temperature_in = 20;
let coolent_temperature_out = 20;
let game_running = true;



//restart the world with new random init
function initStacks() {
    Matter.World.clear(engine.world);

    neutrons = [];
    fuels = [];
    moderators = [];
    reflectors = [];
    poisons = [];
    core_materials = [];
    avg_rads = 1;
    avg_power = 1;
    avg_n_speed = 1;
    total_births = 1;
    total_deaths = 1;
    curently_alive = 1;
    coolent_temperature_in = 20;
    coolent_temperature_out = 20;

    game_running = true;

    let x_pos = FUEL_SIZE * 4;
    let drop_height = 450;
    let reactor_width = FUEL_SIZE * 10.2;
    let reactor_center = x_pos + reactor_width / 2;

    let poison_stack = Matter.Composites.stack(800 + x_pos, HEIGHT - drop_height, 1, 10, 0, 0, function (x, y) {
        let m = make_poison(x, y);
        poisons.push(m);
        core_materials.push(m);
        return m;
    });
    let moderator_stack = Matter.Composites.stack(700 + x_pos, HEIGHT - drop_height, 1, 10, 0, 0, function (x, y) {
        let m = make_moderator(x, y);
        moderators.push(m);
        core_materials.push(m);
        return m;
    });
    let reflector_left = Matter.Composites.stack(10 + x_pos, HEIGHT - drop_height, 2, 8, 0, 0, function (x, y) {
        let m = make_reflector(x, y);
        reflectors.push(m);
        core_materials.push(m);
        return m;
    });
    let reflector_right = Matter.Composites.stack(x_pos + reactor_width - (2 * FUEL_SIZE), HEIGHT - drop_height - 50, 2, 8, 0, 0, function (x, y) {
        let m = make_reflector(x, y);
        reflectors.push(m);
        core_materials.push(m);
        return m;
    });
    let reflector_xtra = Matter.Composites.stack((2 * FUEL_SIZE), HEIGHT - drop_height, 1, 10, 0, 0, function (x, y) {
        let m = make_reflector(x, y);
        reflectors.push(m);
        core_materials.push(m);
        return m;
    });
    // let reflector_top = Matter.Composites.stack(x_pos, HEIGHT - drop_height - 300, 10, 1, 0, 0, function (x, y) {
    //     let m = make_reflector(x, y);
    //     reflectors.push(m);
    //     core_materials.push(m);
    //     return m;
    // });
    let reflector_bottom = Matter.Composites.stack(x_pos, HEIGHT - 40, 10, 1, 0, 0, function (x, y) {
        let m = make_reflector(x, y);
        reflectors.push(m);
        core_materials.push(m);
        return m;
    });


    let rand_stack = Matter.Composites.stack(x_pos + FUEL_SIZE * 2, HEIGHT - drop_height + 50, 6, 6, 0, 0, function (x, y) {
        let rnd = Math.random();
        if (rnd < 0.25) {
            let m = make_moderator(x, y);
            moderators.push(m);
            core_materials.push(m);
            return m;
        }
        if (rnd < 0.35) {
            let m = make_reflector(x, y);
            reflectors.push(m);
            core_materials.push(m);
            return m;
        }
        if (rnd < 0.40) {
            let m = make_poison(x, y);
            poisons.push(m);
            core_materials.push(m);
            return m;
        }
        let f = make_fuel(x, y);
        fuels.push(f);
        return f;
    });


    Matter.World.add(engine.world, [
        poison_stack,
        moderator_stack,
        reflector_bottom,
        reflector_left,
        reflector_right,
        //reflector_top,
        reflector_xtra,
        rand_stack,
        // boundary walls
        wall(WIDTH / 2, 0, WIDTH, WALL_THICKNESS),   // top
        wall(WIDTH / 2, HEIGHT, WIDTH, WALL_THICKNESS), // bottom
        wall(0, HEIGHT / 2, WALL_THICKNESS, HEIGHT),   // left edge
        wall(x_pos, HEIGHT, WALL_THICKNESS, HEIGHT),  // reactor right
        wall(reactor_width + x_pos, HEIGHT, WALL_THICKNESS, HEIGHT),   // reactor left wall
        wall(WIDTH, HEIGHT / 2, WALL_THICKNESS, HEIGHT), // right edge
    ]);

    //re add mouse since we deleted everything
    Matter.World.add(engine.world, mouseConstraint);
}


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
    for (const p of poisons) {
        //roll for fision
        if (inRange(neutron, p) && Math.random() < p.plugin.crossSection) {
            return p;
        }
    }
    return false;
}

function shouldBeReflected(neutron) {
    for (const reflector of reflectors) {
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
    for (const moderator of moderators) {
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
    for (let fuel_rod of fuels) {
        if (neutron.lastInteratedWith === fuel_rod.id) {
            return false;
        }
        //roll for fision
        //let doplar_reduction = ((1000 - fuel_rod.plugin.temperature) / 1000);
        let doplar_reduction = 1;
        if (inRange(neutron, fuel_rod) && Math.random() < fuel_rod.plugin.crossSection * doplar_reduction) {
            return fuel_rod;
        }
    }
    return false;
}

function get_transfered_heat( material,mcp_speed){
    //COOLING_RATE * mcp_speed * (1 + Math.log(m.plugin.temperature));
    //Q=hA(t1-t2)
    let t2 = coolent_temperature_in + 273.15;
    let t1 = material.plugin.temperature + 273.15;
    let h = HEAT_TRANSFER_COEFFICIENT * mcp_speed;
    let A = material.area
    let Q = h * A * ( t1 - t2 );

    if(Math.abs(Q) > 9999)
    {
        console.log("Q range error",Q);
        return 0;
    }

    return Q;

}

function tick_neutrons(neutrons) {
    let next_gen = [];
    let deaths = 0;
    let births = 0;
    let new_rads = 0;
    let new_power = 0;
    let new_speed = 1;
    let mcp_speed = mcp_slider.value / 100.0;

    //calculate power
    for (let m of core_materials) {
        //let Q = get_transfered_heat(m,mcp_speed);

        //m.plugin.temperature -= (Q / (U_SPECIFIC_HEAT/(m.mass*1000)));
        //new_power += Q;

    }

    for (let fuel_rod of fuels) {
        let Q = get_transfered_heat(fuel_rod,mcp_speed);
        //dT = Q/(m*cp) 
        if (fuel_rod.plugin.temperature > FUEL_EXPLODE_TEMP) {
            //overheated fuel rods release a lot of rads!
            new_rads += 2;
        }

        fuel_rod.plugin.temperature -= (Q / (U_SPECIFIC_HEAT/(fuel_rod.mass*1000)));
        new_power += Q*POWER_SCALE;

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


    total_births += births;
    total_deaths += deaths;
    curently_alive = total_births - total_deaths;
    avg_rads = ((avg_rads * 29) + new_rads) / 30.0; //smooth rads
    avg_power = ((avg_power * 9) + new_power) / 10.0; //smooth power

    if (new_neutrons.length > 0) {
        new_speed = (total_n_speed + 0.1) / new_neutrons.length;
        avg_n_speed = ((avg_n_speed * 29) + new_speed) / 30.0;
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

function get_stats() {
    let sum = 0;//= fuels.reduce((previous, current) => current.plugin.temperature += previous);

    let max_temp = 0;
    for (const fuel_rod of fuels) {
        sum += fuel_rod.plugin.temperature;
        if (max_temp < fuel_rod.plugin.temperature) {
            max_temp = fuel_rod.plugin.temperature;
        }
    }

    let avg_temp = sum / fuels.length;

    let stats = {
        neutron_count: neutrons.length,
        mean_fuel_temp: avg_temp,
        max_fuel_temp: max_temp,
        time: performance.now()
    }
    return stats;
}


function beforeRenderHandler() {

    //clear the main canvas
    context.clearRect(0, 0, WIDTH, HEIGHT);

    //draw heat circles behind fuel
    fuels.forEach(function (fuel_rod) {
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
    });

    t0 = performance.now();

}


function afterRenderHandler() {

    t1 = performance.now();
    avg_physics_time = ((avg_physics_time * 29) + (t1 - t0)) / 30.0;

    t0 = performance.now();
    neutrons = tick_neutrons(neutrons);
    t1 = performance.now();
    avg_tick_time = ((avg_tick_time * 29) + (t1 - t0)) / 30.0;

    t0 = performance.now();
    draw_neutrons(neutrons);
    t1 = performance.now();
    avg_draw_time = ((avg_draw_time * 29) + (t1 - t0)) / 30.0;

    let prev_stats = stats;
    stats = get_stats();
    let new_worth = (stats.neutron_count / (prev_stats.neutron_count + 0.000000000001));
    if (!isNaN(new_worth)) {
        worth = ((worth * 0.9) + (new_worth * 0.1));
    }
    //document.getElementById("worth").innerHTML = "worth: " + worth.toPrecision(10);
    document.getElementById("worth").innerHTML = "alive: " + curently_alive.toPrecision(5);

    //document.getElementById("worth" + "GaugeContainer").dataset.value = worth;
    document.getElementById("meanFuelTemp" + "GaugeContainer").dataset.value = stats.mean_fuel_temp;
    document.getElementById("maxFuelTemp" + "GaugeContainer").dataset.value = stats.max_fuel_temp;
    document.getElementById("neutron_count" + "GaugeContainer").dataset.value = stats.neutron_count;
    document.getElementById("neutron_speed" + "GaugeContainer").dataset.value = avg_n_speed;
    document.getElementById("rad" + "GaugeContainer").dataset.value = avg_rads;
    document.getElementById("power" + "GaugeContainer").dataset.value = avg_power;
    document.getElementById("perf").innerHTML =
        "      tick N : " + avg_tick_time.toPrecision(3) + " ms."
        + "<br>draw N : " + avg_draw_time.toPrecision(3) + " ms."
        + "<br>pyhsics: " + avg_physics_time.toPrecision(3) + " ms.";
    frame_number += 1;
    checkGameOver();
}


function checkGameOver()
{
    if(avg_rads > 50)
    {
        showGameOver("Too many rads emmited offsite. The NRC shut you down! You did not get a very favorable review in the IAEA report...");
    }
    if(stats.mean_fuel_temp > 1000)
    {
        showGameOver("A meltdown ‽  How did you possibly manage to melt down an RBMK reactor? Now this browser tab wont't be usable for 1000 years!");
    }
}
