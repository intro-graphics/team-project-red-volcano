import {defs, tiny} from './common.js';
//import { tiny, defs } from "./project-resources.js";
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
            program_state.set_camera(Mat4.translation(0, 0, -10).times(Mat4.rotation(this.deg_to_rads(20), 1, 0, 0,)
                                                                .times(Mat4.rotation(this.deg_to_rads(155), 0, 1, 0))));
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

export class Volcano extends Volcano_Base {
    constructor() {
        super();

        // Load the object model file:
        this.shapes = {"volcano": new Shape_From_File("assets/volcano_main.obj"),
                        "water": new Shape_From_File("assets/water.obj"),
                         "ring": new Shape_From_File("assets/ring.obj"),
                         "tree": new Shape_From_File("assets/MapleTreeStem.obj"),
                        "tree_leaves": new Shape_From_File( "assets/MapleTreeLeaves.obj" ),
                        "wall": new Shape_From_File( "assets/wall.obj" ),
                        "smoke":new Shape_From_File("assets/smoke.obj"),
                        "cloud":new Shape_From_File("assets/cloud.obj"),
                        "drop":new Shape_From_File("assets/drop.obj")};

        // Define material for volcano
        this.volcano = new Material(new defs.Phong_Shader(1), {
            color: color(61 / 255, 51 / 255, 50 / 255, 1),
            ambient: 1,
            diffusivity: 1
        });
        this.water = new Material(new defs.Phong_Shader(1), {
            color: color(0, 0.3, 0.4, 1),
            ambient: 1,
            diffusivity: 1
        });
        this.ring = new Material(new defs.Phong_Shader(1), {
            color: color(0.24, 0.1, 0.1, 1),
            ambient: 1,
            diffusivity: 1 ,
            texture: new Texture( "assets/smoke.jpg" )
        });
        this.tree = new Material(new defs.Phong_Shader(1), {
            color: color(61 / 255, 51 / 255, 50 / 255, 1),
            ambient: 1,
            diffusivity: 1 ,
            texture: new Texture( "assets/smoke.jpg" )
        });
        this.tree_leaves = new Material(new defs.Phong_Shader(1), {
            color: color(0, 0.3, 0, 1),
            ambient: 1,
            diffusivity: 1 ,
            texture: new Texture( "assets/smoke.jpg" )
        });
        this.wall = new Material(new defs.Phong_Shader(1), {
            color: color(1, 0.8, 0, 1),
            //color: color(0, 0.6, 1, 1),
            ambient: 0.8,
            diffusivity: 0 ,
            texture: new Texture( "assets/smoke.jpg" )
        });
        this.cloud = new Material(new defs.Phong_Shader(1), {
            color: color(0.5, 0.5, 0.5, 1),
            ambient: 0.8,
            diffusivity: 1 ,
            //texture: new Texture( "assets/smoke.jpg" )
        });
        this.drop = new Material(new defs.Phong_Shader(1), {
            color: color(0, 0, 1, 1),
            ambient: 0.8,
            diffusivity: 1 ,
            texture: new Texture( "assets/smoke.jpg" )
        });

        for(let j = 0; j < 130; j++){
            velocity[j] = getRandomArbitrary(0.2, 1) ;
        }

        for(let j = 0; j < 50; j++){
            velocity2[j] = getRandomArbitrary(0.1, 0.2) ;
        }

        this.crosshair_Matrix = Mat4.scale(0.4,0.4,0.4).times(Mat4.translation(5, 8, 0));
    }


    make_control_panel()
    {
        this.key_triggered_button( "Move Left", [ "j" ], this.move_left );
        this.key_triggered_button( "Move Right", [ "l" ], this.move_right );
        this.key_triggered_button( "Move Up", [ "i" ], this.move_up );
        this.key_triggered_button( "Move Down", [ "k" ], this.move_down );
        this.key_triggered_button( "Rain on/off", [ "t" ], this.Rain );
        this.key_triggered_button( "Smoke on/off", [ "m" ], this.Smoke );
    }

    move_left()
    {
            this.crosshair_Matrix = this.crosshair_Matrix.times(Mat4.translation(0.2, 0, 0));
            xDrop += 4;
    }
    move_right()
    {
            this.crosshair_Matrix = this.crosshair_Matrix.times(Mat4.translation(-0.2, 0, 0));
            xDrop -= 4;
    }

    move_up()
    {
        this.crosshair_Matrix = this.crosshair_Matrix.times(Mat4.translation(0, 0.2, 0));
        yDrop += 4;
    }

    move_down()
    {
        this.crosshair_Matrix = this.crosshair_Matrix.times(Mat4.translation(0, -0.2, 0));
        yDrop -= 4;
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

    move_further()
    {
        this.crosshair_Matrix = this.crosshair_Matrix.times(Mat4.translation(0, 0, -0.2));
    }

    move_closer()
    {
        this.crosshair_Matrix = this.crosshair_Matrix.times(Mat4.translation(0, 0, 0.2));
    }


    display(context, program_state) {

        super.display(context, program_state);
        const t = program_state.animation_time;

        // Scene setup
        program_state.projection_transform = Mat4.perspective(Math.PI / 4, context.width / context.height, 1, 500);
        program_state.lights = [new Light(Mat4.rotation(500, 5, 0, 0).times(vec4(3, 2, 10, 1)), color(1, .7, .7, 1), 100000),];

        //Smoke
        this.smoke = new Material(new defs.Phong_Shader(1), {color: color(0.1, 0.1, 0.1, 1), ambient: .3, diffusivity: 1, specularity: .5 , texture: new Texture( "assets/stars.png" )});
            particles.push(this.smoke);


        //Particles Movement
        for (let i = 0; i < particles.length; i++){
            let model_transform9 = Mat4.scale(0.05 + (10 + ((t/((velocity[i])*800))%30))*3/1000,
                                        0.05 +(10 + ((t/((velocity[i])*800))%30))*3/1000, 0.05 + (10 + ((t/((velocity[i])*800))%30))*3/1000)
                                        .times(Mat4.translation(-5 + i/15, 3 + ((t/((velocity[i])*800))%30), 0));
            if(10 + ((t/((velocity[i])*800))%30) < 29){
                if(smokeOn === 0){
                    this.shapes.smoke.draw(context, program_state, model_transform9, particles[i]);
                }
            }
        }

        //Draw volcano
        let model_transform = Mat4.identity();
        this.shapes.volcano.draw(context, program_state, model_transform, this.volcano);


        //Draw water
        const model_transform2 = Mat4.scale(2, 2, 2).times(Mat4.translation(0, -0.35, 0));
        this.shapes.water.draw(context, program_state, model_transform2, this.water);

        const model_transform3 = Mat4.scale(2.2, 2.2, 2.2).times(Mat4.translation(0, -0.35, 0));
        this.shapes.ring.draw(context, program_state, model_transform3, this.ring);


        //Draw tree
        const model_transform4 = Mat4.scale(0.06, 0.06, 0.06).times(Mat4.translation(-16, -2.5, -25));
        this.shapes.tree.draw(context, program_state, model_transform4, this.tree);
        const model_transform6 = Mat4.scale(0.06, 0.06, 0.06).times(Mat4.translation(-18, -2.7, -25));
        this.shapes.tree.draw(context, program_state, model_transform6, this.tree);

        const model_transform5 = Mat4.scale(0.06, 0.06, 0.06).times(Mat4.translation(-16, -2.5, -25));
        this.shapes.tree_leaves.draw(context, program_state, model_transform5, this.tree_leaves);
        const model_transform7 = Mat4.scale(0.06, 0.06, 0.06).times(Mat4.translation(-18, -2.7, -25));
        this.shapes.tree_leaves.draw(context, program_state, model_transform7, this.tree_leaves);


        //Draw Wall
        const model_transform8 = Mat4.scale(6, 5.5, 2.2).times(Mat4.translation(4, -0.35, 10).times( Mat4.rotation( 0.56,0,1,0 ) ));
        this.shapes.wall.draw(context, program_state, model_transform8, this.wall);


        //Draw cloud
        this.shapes.cloud.draw(context, program_state, this.crosshair_Matrix, this.cloud);


        //Draw Drop
        this.drop = new Material(new defs.Phong_Shader(1), {color: color(0, 0, 1, 1), ambient: .3, diffusivity: 1, specularity: .5 , texture: new Texture( "assets/stars.png" )});
        particles2.push(this.drop);

        for (let i = 0; i < particles2.length; i++){
            let model_transform10 = Mat4.scale(0.02,0.02,0.02).times(Mat4.translation(90 + i/2 + xDrop, (yDrop + 150) - ((t/((velocity2[i])*400))%120), 0));
            if((150 - ((t/((velocity2[i])*400))%120)) > 90){
                if(rainOn === 1){
                    this.shapes.drop.draw(context, program_state, model_transform10, particles2[i]);
                }
            }
        }
    }
}