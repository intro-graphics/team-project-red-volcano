import {defs, tiny} from './common.js';
// Pull these names into this module's scope for convenience:
const {vec3, vec4, vec, color, Mat4, Light, Shape, Material, Shader, Texture, Scene} = tiny;

export class Shape_From_File extends Shape {                                   // **Shape_From_File** is a versatile standalone Shape that imports
                                                                               // all its arrays' data from an .obj 3D model file.
    constructor(filename) {
        super("position", "normal", "texture_coord");
        // Begin downloading the mesh. Once that completes, return
        // control to our parse_into_mesh function.
        this.load_file(filename);
    }

    load_file(filename) { // Request the external file and wait for it to load.
        // Failure mode:  Loads an empty shape.
        return fetch(filename)
            .then(response => {
                if (response.ok) return Promise.resolve(response.text())
                else return Promise.reject(response.status)
            })
            .then(obj_file_contents => this.parse_into_mesh(obj_file_contents))
            .catch(error => {
                this.copy_onto_graphics_card(this.gl);
            })
    }

    parse_into_mesh(data) { // Adapted from the "webgl-obj-loader.js" library found online:
        var verts = [], vertNormals = [], textures = [], unpacked = {};

        unpacked.verts = [];
        unpacked.norms = [];
        unpacked.textures = [];
        unpacked.hashindices = {};
        unpacked.indices = [];
        unpacked.index = 0;

        var lines = data.split('\n');

        var VERTEX_RE = /^v\s/;
        var NORMAL_RE = /^vn\s/;
        var TEXTURE_RE = /^vt\s/;
        var FACE_RE = /^f\s/;
        var WHITESPACE_RE = /\s+/;

        for (var i = 0; i < lines.length; i++) {
            var line = lines[i].trim();
            var elements = line.split(WHITESPACE_RE);
            elements.shift();

            if (VERTEX_RE.test(line)) verts.push.apply(verts, elements);
            else if (NORMAL_RE.test(line)) vertNormals.push.apply(vertNormals, elements);
            else if (TEXTURE_RE.test(line)) textures.push.apply(textures, elements);
            else if (FACE_RE.test(line)) {
                var quad = false;
                for (var j = 0, eleLen = elements.length; j < eleLen; j++) {
                    if (j === 3 && !quad) {
                        j = 2;
                        quad = true;
                    }
                    if (elements[j] in unpacked.hashindices)
                        unpacked.indices.push(unpacked.hashindices[elements[j]]);
                    else {
                        var vertex = elements[j].split('/');

                        unpacked.verts.push(+verts[(vertex[0] - 1) * 3 + 0]);
                        unpacked.verts.push(+verts[(vertex[0] - 1) * 3 + 1]);
                        unpacked.verts.push(+verts[(vertex[0] - 1) * 3 + 2]);

                        if (textures.length) {
                            unpacked.textures.push(+textures[((vertex[1] - 1) || vertex[0]) * 2 + 0]);
                            unpacked.textures.push(+textures[((vertex[1] - 1) || vertex[0]) * 2 + 1]);
                        }

                        unpacked.norms.push(+vertNormals[((vertex[2] - 1) || vertex[0]) * 3 + 0]);
                        unpacked.norms.push(+vertNormals[((vertex[2] - 1) || vertex[0]) * 3 + 1]);
                        unpacked.norms.push(+vertNormals[((vertex[2] - 1) || vertex[0]) * 3 + 2]);

                        unpacked.hashindices[elements[j]] = unpacked.index;
                        unpacked.indices.push(unpacked.index);
                        unpacked.index += 1;
                    }
                    if (j === 3 && quad) unpacked.indices.push(unpacked.hashindices[elements[0]]);
                }
            }
        }
        {
            const {verts, norms, textures} = unpacked;
            for (var j = 0; j < verts.length / 3; j++) {
                this.arrays.position.push(vec3(verts[3 * j], verts[3 * j + 1], verts[3 * j + 2]));
                this.arrays.normal.push(vec3(norms[3 * j], norms[3 * j + 1], norms[3 * j + 2]));
                this.arrays.texture_coord.push(vec(textures[2 * j], textures[2 * j + 1]));
            }
            this.indices = unpacked.indices;
        }
        this.normalize_positions(false);
        this.ready = true;
    }

    draw(context, program_state, model_transform, material) { // draw(): Same as always for shapes, but cancel all
        // attempts to draw the shape before it loads:
        if (this.ready)
            super.draw(context, program_state, model_transform, material);
    }
}

// Sphere shape from assignment 3
window.Subdivision_Sphere =
    class Subdivision_Sphere extends Shape  // This Shape defines a Sphere surface, with nice uniform triangles.  A subdivision surface (see
    {                                       // Wikipedia article on those) is initially simple, then builds itself into a more and more
                                            // detailed shape of the same layout.  Each act of subdivision makes it a better approximation of
                                            // some desired mathematical surface by projecting each new point onto that surface's known
                                            // implicit equation.  For a sphere, we begin with a closed 3-simplex (a tetrahedron).  For each
                                            // face, connect the midpoints of each edge together to make more faces.  Repeat recursively until
                                            // the desired level of detail is obtained.  Project all new vertices to unit vectors (onto the
        constructor(max_subdivisions)       // unit sphere) and group them into triangles by following the predictable pattern of the recursion.
        {
            super("positions", "normals", "texture_coords");                      // Start from the following equilateral tetrahedron:
            this.positions.push(...vec.cast([0, 0, -1], [0, .9428, .3333], [-.8165, -.4714, .3333], [.8165, -.4714, .3333]));

            this.subdivideTriangle(0, 1, 2, max_subdivisions);  // Begin recursion.
            this.subdivideTriangle(3, 2, 1, max_subdivisions);
            this.subdivideTriangle(1, 0, 3, max_subdivisions);
            this.subdivideTriangle(0, 2, 3, max_subdivisions);

            for (let p of this.positions) {
                this.normals.push(p.copy());                 // Each point has a normal vector that simply goes to the point from the origin.

                // Textures are tricky.  A Subdivision sphere has no straight seams to which image
                // edges in UV space can be mapped.  The only way to avoid artifacts is to smoothly
                this.texture_coords.push(                      // wrap & unwrap the image in reverse - displaying the texture twice on the sphere.
                    vec.of(Math.asin(p[0] / Math.PI) + .5, Math.asin(p[1] / Math.PI) + .5))
            }
        }

        subdivideTriangle(a, b, c, count)   // Recurse through each level of detail by splitting triangle (a,b,c) into four smaller ones.
        {
            if (count <= 0) {
                this.indices.push(a, b, c);
                return;
            }  // Base case of recursion - we've hit the finest level of detail we want.

            var ab_vert = this.positions[a].mix(this.positions[b], 0.5).normalized(),     // We're not at the base case.  So, build 3 new
                ac_vert = this.positions[a].mix(this.positions[c], 0.5).normalized(),     // vertices at midpoints, and extrude them out to
                bc_vert = this.positions[b].mix(this.positions[c], 0.5).normalized();     // touch the unit sphere (length 1).

            var ab = this.positions.push(ab_vert) - 1,      // Here, push() returns the indices of the three new vertices (plus one).
                ac = this.positions.push(ac_vert) - 1,
                bc = this.positions.push(bc_vert) - 1;

            this.subdivideTriangle(a, ab, ac, count - 1);          // Recurse on four smaller triangles, and we're done.  Skipping every
            this.subdivideTriangle(ab, b, bc, count - 1);          // fourth vertex index in our list takes you down one level of detail,
            this.subdivideTriangle(ac, bc, c, count - 1);          // and so on, due to the way we're building it.
            this.subdivideTriangle(ab, bc, ac, count - 1);
        }
    }

// Use to organize adding any necessary controls
class Volcano_Base extends Scene {
    constructor() {
        super();
    }

    // To add content to the "Volcano" panel (See assignments and "transforms-sandbox.js" for examples)
    make_control_panel() {

    }

    deg_to_rads(angle_in_degree) {
        return angle_in_degree * (Math.PI / 180)
    }

    display(context, program_state) {
        if (!context.scratchpad.controls) {
            this.children.push(context.scratchpad.controls = new defs.Movement_Controls());
            // Also set initial camera position
            program_state.set_camera(Mat4.translation(0, -0.2, -6).times(Mat4.rotation(this.deg_to_rads(20), 1, 0, 0,).times(Mat4.rotation(this.deg_to_rads(160), 0, 1, 0))));
        }
    }
}


function getRndInteger(min, max) {
    return Math.floor(Math.random() * (max - min) ) + min;
}

function getRandomArbitrary(min, max) {
    return Math.random() * (max - min) + min;
}


let particles = [];
let velocity = [];
let particles2 = [];
let velocity2 = [];
let xDrop = 0;
let yDrop = 0;
let rainOn = 0;
let smokeOn = 0;
let cyCloude = 8;
let cxCloude = 5;
let lava2Z = 0;
let lava3Z = 0;
let lava4Z = 0;
let lava5Z = 0;
let lava6Z = 0;

export class Volcano extends Volcano_Base {
    constructor() {
        super();

        // Load the object model file:
        this.shapes = {
            "volcano": new Shape_From_File("assets/volcano.obj"),
            "water": new Shape_From_File("assets/water.obj"),
            "base": new Shape_From_File("assets/model_base.obj"),
            "background": new Shape_From_File("assets/background.obj"),
            "medieval_house": new Shape_From_File("assets/medieval_simple_house.obj"),
            "shack": new Shape_From_File("assets/shack.obj"),
            "watchtower": new Shape_From_File("assets/watchtower.obj"),
            "smoke":new Shape_From_File("assets/smoke.obj"),
            "cloud":new Shape_From_File("assets/cloud.obj"),
            "drop":new Shape_From_File("assets/drop.obj"),
            "lava2":new Shape_From_File("assets/lava2.obj"),
            "lava3":new Shape_From_File("assets/lava3.obj"),
            // "lava": new (Subdivision_Sphere.prototype.make_flat_shaded_version())(1)
        };

        // Define material for volcano
        this.background = new Material(new defs.Phong_Shader(1), {
            color: color(40 / 255, 40 / 255, 40 / 255, 1),
            ambient: 0.5,
            diffusivity: .5,
            specularity: 0
        });
        this.video_background = new Material(new defs.Textured_Phong(1), {
            color: color(0, 0, 0, 1),
            ambient: 1,
            diffusivity: 0,
            specularity: 0,
            texture: new Texture("assets/video_img.png")
        });
        this.base = new Material(new defs.Phong_Shader(1), {
            color: color(12 / 255, 12 / 255, 12 / 255, 1),
            ambient: 1,
            diffusivity: 1,
            specularity: 0.2
        });
        this.water = new Material(new defs.Phong_Shader(1), {
            color: color(0, 0.3, 0.4, 1),
            ambient: 1,
            diffusivity: 1,
            specularity: 0.4
        });
        this.volcano = new Material(new defs.Phong_Shader(1), {
            color: color(30 / 255, 30 / 255, 30 / 255, 1),
            ambient: 1,
            diffusivity: 1,
            specularity: 0.1
        });
        this.medieval_house = new Material(new defs.Phong_Shader(1), {
            color: color(101 / 255, 69 / 255, 52 / 255, 1),
            ambient: 0.3,
            diffusivity: 0.2,
            specularity: 0
        });
        this.shack = new Material(new defs.Phong_Shader(1), {
            color: color(169 / 255, 104 / 255, 81 / 255, 1),
            ambient: 0.3,
            diffusivity: 0.3,
            specularity: 0
        });
        this.watchtower = new Material(new defs.Phong_Shader(1), {
            color: color(92 / 255, 77 / 255, 77 / 255, 1),
            ambient: 0.2,
            diffusivity: 0.5,
            specularity: 0
        });
        this.lava = new Material(new defs.Phong_Shader(1), {
            color: color(255 / 255, 139 / 255, 57 / 255, 1),
            ambient: 0.2,
            diffusivity: 0.5,
            specularity: 0.5
        });
        this.cloud = new Material(new defs.Phong_Shader(1), {
            color: color(0.5, 0.5, 0.5, 1),
            ambient: 0.8,
            diffusivity: 1
        });
        this.drop = new Material(new defs.Phong_Shader(1), {
            color: color(0, 0, 1, 1),
            ambient: 0.8,
            diffusivity: 1
        });
        this.lava = new Material(new defs.Phong_Shader(1), {
            color: color(1, 0.1, 0, 1),
            ambient: 0.8,
            diffusivity: 0.2
        });

        for(let j = 0; j < 130; j++){
            velocity[j] = getRandomArbitrary(0.2, 1) ;
        }

        for(let j = 0; j < 50; j++){
            velocity2[j] = getRandomArbitrary(0.1, 0.2) ;
        }
        this.crosshair_Matrix = Mat4.scale(0.25,0.25,0.25).times(Mat4.translation(5, 8, 1.1));

        this.background_toggle = this.background;
    }

    make_control_panel()
    {
        this.key_triggered_button( "Graduation Background on/off", [ "b" ], () => this.background_toggle = this.background_toggle === this.background ? this.video_background : this.background);
        this.new_line();
        this.key_triggered_button( "Rain on/off", [ "t" ], this.Rain );
        this.key_triggered_button( "Smoke on/off", [ "m" ], this.Smoke );
        this.new_line();
        this.key_triggered_button( "Move Left", [ "j" ], this.move_left );
        this.key_triggered_button( "Move Right", [ "l" ], this.move_right );
        this.key_triggered_button( "Move Up", [ "i" ], this.move_up );
        this.key_triggered_button( "Move Down", [ "k" ], this.move_down );
    }

    move_left()
    {
        this.crosshair_Matrix = this.crosshair_Matrix.times(Mat4.translation(0.2, 0, 0));
        cxCloude +=0.2;
        xDrop += 2.5;
    }
    move_right()
    {
        this.crosshair_Matrix = this.crosshair_Matrix.times(Mat4.translation(-0.2, 0, 0));
        cxCloude -=0.2;
        xDrop -= 2.5;
    }

    move_up()
    {
        this.crosshair_Matrix = this.crosshair_Matrix.times(Mat4.translation(0, 0.2, 0));
        cyCloude += 0.2;
        yDrop += 2.5;
    }

    move_down()
    {
        this.crosshair_Matrix = this.crosshair_Matrix.times(Mat4.translation(0, -0.2, 0));
        cyCloude -= 0.2;
        yDrop -= 2.5;
    }

    Rain()
    {
        if(rainOn === 0){
            rainOn = 1
        }
        else{
            rainOn = 0;
        }
    }

    Smoke()
    {
        if(smokeOn === 0){
            smokeOn = 1
        }
        else{
            smokeOn = 0;
        }
    }


    //######################  Display  ############################\\


    display(context, program_state) {
        super.display(context, program_state);
        const t = program_state.animation_time;

        // Scene setup
        program_state.projection_transform = Mat4.perspective(Math.PI / 4, context.width / context.height, 1, 500);
        // program_state.lights = [new Light(Mat4.rotation(250, 1, 0, 0).times(vec4(3, 2, 10, 1)), color(1, 1, 1, 1), 100000)];
        program_state.lights = [new Light(Mat4.rotation(250, 1, 0, 0).times(Mat4.rotation(30, 0, 1, 0)).times(vec4(3, 2, 10, 1)), color(1, 1, 1, 1), 100000)];

        // Scene background
        const background_transform = Mat4.identity()
            .times(Mat4.scale(5, 5, 2.2))
            .times(Mat4.translation(3, -0.35, 7))
            .times(Mat4.rotation(0.56, 0, 1, 0))
            .times(Mat4.rotation(-1.5708, 0, 0, 1));
        this.shapes.background.draw(context, program_state, background_transform, this.background_toggle);

        // Scene base
        const base_transform = Mat4.scale(2, 2, 2)
            .times(Mat4.translation(0, -0.35, 0));
        this.shapes.base.draw(context, program_state, base_transform, this.base);

        // Draw water
        const water_transform = Mat4.scale(1.345, 1.345, 1.345)
            .times(Mat4.translation(0, -0.46, 0));
        this.shapes.water.draw(context, program_state, water_transform, this.water);

        // Draw volcano
        const volcano_transform = Mat4.identity()
            .times(Mat4.translation(0, -0.43, 0))
            .times(Mat4.scale(0.8, 0.8, 0.8));
        this.shapes.volcano.draw(context, program_state, volcano_transform, this.volcano);


        //Draw Smoke
        this.smoke = new Material(new defs.Phong_Shader(1), {color: color(0.5, 0.5, 0.5, 1), ambient: .3, diffusivity: 1, specularity: .5});
        particles.push(this.smoke);


        //Particles Movement
        for (let i = 0; i < particles.length; i++){
            let smoke_transform = Mat4.scale(
                0.02 + (10 + ((t/((velocity[i])*800))%30))*3/1000,
                0.02 + (10 + ((t/((velocity[i])*800))%30))*3/1000,
                0.02 + (10 + ((t/((velocity[i])*800))%30))*3/1000)
                .times(Mat4.translation(-2 + i/20, ((t/((velocity[i])*800))%30), 4));
            if(10 + ((t/((velocity[i])*800))%30) < 29){
                let distance = (cyCloude + 6.5) - (((t/((velocity[i])*800))%30));
                let range = cyCloude - (-5 + i/15);
                if(!(cxCloude < 1.8  && cxCloude > -1.4 && distance < 0.06 )){
                    if(smokeOn === 0){
                        this.shapes.smoke.draw(context, program_state, smoke_transform, particles[i]);
                    }
                }
            }
        }

        //Draw Smoke cloud
        this.shapes.cloud.draw(context, program_state, this.crosshair_Matrix, this.cloud);

        //Draw lava
        let lavaY = -1.3 + t/10000;
        if (lavaY > 0 ){
            lavaY = 0;
        }
        const lava_transform1 = Mat4.scale(0.25,0.25,0.25).times(Mat4.translation(0, lavaY, 1.1));
        this.shapes.cloud.draw(context, program_state, lava_transform1, this.lava);

        if(lavaY !== 0){
            lava2Z = - t/20000;
        }
        if (lava2Z < -0.3){
            lava2Z = -0.3;
        }
        const lava_transform2 = Mat4.scale(0.25,0.25,0.25).times(Mat4.translation(0, -1.6, lava2Z));
        this.shapes.lava2.draw(context, program_state, lava_transform2, this.lava);

        if(lava3Z !== -0.3){
            lava3Z = - t/20000;
        }
        if (lava3Z < -0.5){
            lava3Z = -0.5;
        }
        const lava_transform5 = Mat4.scale(0.20,0.20,0.20).times(Mat4.translation(-0.91, -1.7, lava3Z).times(Mat4.rotation(4.4, 0, 1, 0)));
        this.shapes.lava3.draw(context, program_state, lava_transform5, this.lava);


        if(lava3Z !== -0.5){
            lava4Z = - t/5000;
        }
        if (lava4Z < -2.4){
            lava4Z = -2.4;
        }
        const lava_transform4 = Mat4.scale(0.20,0.20,0.20).times(Mat4.translation(-1.5, -2.7, lava4Z).times(Mat4.rotation(4.4, 0, 1, 0)));
        this.shapes.lava3.draw(context, program_state, lava_transform4, this.lava);


        if(lava4Z !== -2.4){
            lava5Z = - t/3000;
        }
        if (lava5Z < -3.42){
            lava5Z = -3.42;
        }
        const lava_transform6 = Mat4.scale(0.20,0.20,0.20).times(Mat4.translation(-1.5, -3.2, lava5Z).times(Mat4.rotation(4.4, 0, 1, 0)));
        this.shapes.lava3.draw(context, program_state, lava_transform6, this.lava);




        if(lava5Z !== -3.42){
            lava6Z = - t/2500;
        }
        if (lava6Z < -5){
            lava6Z = -5;
        }
        const lava_transform3 = Mat4.scale(0.25,0.241,0.25).times(Mat4.translation(-0.9, -3.1, lava6Z).times(Mat4.rotation(3.7, 1, 0, 1)));
        this.shapes.lava2.draw(context, program_state, lava_transform3, this.lava);
















        //Draw Drop
        this.drop = new Material(new defs.Phong_Shader(1), {color: color(0, 0, 1, 1), ambient: .3, diffusivity: 1, specularity: .5 });
        particles2.push(this.drop);
        //Drop particles
        for (let i = 0; i < particles2.length; i++){
            let model_transform10 = Mat4.scale(0.02,0.02,0.02)
                                    .times(Mat4.translation(55 + i/2 + xDrop, (yDrop + 100) - ((t/((velocity2[i])*400))%120), 20));
            if((150 - ((t/((velocity2[i])*400))%120)) > 5)
            {
                if(rainOn === 1){
                    this.shapes.drop.draw(context, program_state, model_transform10, particles2[i]);
                }
            }
        }

        // Draw buildings
        const shack_transform2 = Mat4.identity()
            .times(Mat4.scale(.05, .05, .05))
            .times(Mat4.translation(-7, -10, -17))
            .times(Mat4.rotation(0.2, 0, 0, 1));
        this.shapes.shack.draw(context, program_state, shack_transform2, this.shack);

        const medieval_house_transform2 = Mat4.identity()
            .times(Mat4.scale(.05, .05, .05))
            .times(Mat4.translation(12, -11, -16))
            .times(Mat4.rotation(0, -0.5, 0.5, 1));
        this.shapes.medieval_house.draw(context, program_state, medieval_house_transform2, this.medieval_house);

        const shack_transform = Mat4.identity()
            .times(Mat4.scale(0.05, 0.05, 0.05))
            .times(Mat4.translation(-11, -9, -13))
            .times(Mat4.rotation(-.1, 0, 1, 0))
            .times(Mat4.rotation(-.25, 1, 0, 0));
        this.shapes.shack.draw(context, program_state, shack_transform, this.shack);

        const watchtower_transform = Mat4.identity()
            .times(Mat4.scale(0.07, 0.07, 0.07))
            .times(Mat4.translation(-11, -6.6, -10));
        this.shapes.watchtower.draw(context, program_state, watchtower_transform, this.watchtower);

        const watchtower2_transform = Mat4.identity()
            .times(Mat4.scale(0.07, 0.07, 0.07))
            .times(Mat4.translation(6, -6.6, -12))
            .times(Mat4.rotation(4, 0, 1, 0));
        // const watchtower2_brown = color(101, 69, 52, 1);
        this.shapes.watchtower.draw(context, program_state, watchtower2_transform, this.watchtower/*.override({color: watchtower2_brown})*/);
    }
}