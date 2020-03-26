"use strict";

//restart the world with new random init
function initStacks() {
    Matter.World.clear(engine.world);

    state = getEmptyState();

    let reactor_left_wall = FUEL_SIZE * 4;
    
    let reactor_width = FUEL_SIZE * 9.2;
    let reactor_height = FUEL_SIZE * 10.2;
    let reactor_center_x = reactor_left_wall + reactor_width / 2;


    state.core_center_x = reactor_center_x; 
    state.core_center_y = HEIGHT - (reactor_height/2)-FUEL_SIZE; 
    state.core_width =  reactor_width;
    state.core_height = reactor_height;

    let drop_height = 500;

    let poison_stack = Matter.Composites.stack(800 + reactor_left_wall, HEIGHT - drop_height, 1, 10, 0, 0, function (x, y) {
        let m = make_poison(x, y);
        state.poisons.push(m);
        state.core_materials.push(m);
        return m;
    });
    let moderator_stack = Matter.Composites.stack(700 + reactor_left_wall, HEIGHT - drop_height, 1, 10, 0, 0, function (x, y) {
        let m = make_moderator(x, y);
        state.moderators.push(m);
        state.core_materials.push(m);
        return m;
    });
    let reflector_left = Matter.Composites.stack(10 + reactor_left_wall, HEIGHT - drop_height, 2, 8, 0, 0, function (x, y) {
        let m = make_reflector(x, y);
        state.reflectors.push(m);
        state.core_materials.push(m);
        return m;
    });
    let reflector_right = Matter.Composites.stack(reactor_left_wall + reactor_width - (2 * FUEL_SIZE), HEIGHT - drop_height - 50, 2, 8, 0, 0, function (x, y) {
        let m = make_reflector(x, y);
        state.reflectors.push(m);
        state.core_materials.push(m);
        return m;
    });
    let reflector_xtra = Matter.Composites.stack((2 * FUEL_SIZE), HEIGHT - drop_height, 1, 10, 0, 0, function (x, y) {
        let m = make_reflector(x, y);
        state.reflectors.push(m);
        state.core_materials.push(m);
        return m;
    });
    // let reflector_top = Matter.Composites.stack(x_pos, HEIGHT - drop_height - 300, 10, 1, 0, 0, function (x, y) {
    //     let m = make_reflector(x, y);
    //     reflectors.push(m);
    //     core_materials.push(m);
    //     return m;
    // });
    let reflector_bottom = Matter.Composites.stack(reactor_left_wall, HEIGHT - 100, 10, 1, 0, 0, function (x, y) {
        let m = make_reflector(x, y);
        state.reflectors.push(m);
        state.core_materials.push(m);
        return m;
    });


    let rand_stack = Matter.Composites.stack(reactor_left_wall + FUEL_SIZE * 2, HEIGHT - drop_height + 50, 5, 5, 0, 0, function (x, y) {
        let rnd = Math.random();
        if (rnd < 0.25) {
            let m = make_moderator(x, y);
            state.moderators.push(m);
            state.core_materials.push(m);
            return m;
        }
        if (rnd < 0.35) {
            let m = make_reflector(x, y);
            state.reflectors.push(m);
            state.core_materials.push(m);
            return m;
        }
        if (rnd < 0.50) {
            let m = make_poison(x, y);
            state.poisons.push(m);
            state.core_materials.push(m);
            return m;
        }
        let f = make_fuel(x, y);
        state.fuels.push(f);
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

        wall(reactor_center_x, HEIGHT - FUEL_SIZE, reactor_width,WALL_THICKNESS),   // reactor bottom wall
        wall(reactor_left_wall, state.core_center_y, WALL_THICKNESS, reactor_height),  // reactor right
        wall(reactor_width + reactor_left_wall, state.core_center_y, WALL_THICKNESS, reactor_height),   // reactor left wall
        wall(WIDTH, HEIGHT / 2, WALL_THICKNESS, HEIGHT), // right edge
    ]);

    //re add mouse since we deleted everything
    Matter.World.add(engine.world, mouseConstraint);
}