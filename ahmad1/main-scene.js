window.Volcano = window.classes.Volcano =
class Volcano extends Scene_Component
//export class Volcano extends Scene
  { constructor( context, control_box )
      { super(   context, control_box );    
        if( !context.globals.has_controls   ) 
          context.register_scene_component( new Movement_Controls( context, control_box.parentElement.insertCell() ) ); 

        //context.globals.graphics_state.camera_transform = Mat4.look_at( Vec.of( 0, -20, 15 ), Vec.of( 0,0,0 ), Vec.of( 0,10, 0 ) );

        context.globals.graphics_state.camera_transform = Mat4.look_at( Vec.of( 0, -5, 1030 ), Vec.of( 0, 100, 0 ), Vec.of( 0, 10, 0 ) );

        const r = context.width/context.height;
        context.globals.graphics_state.projection_transform = Mat4.perspective( Math.PI/4, r, .1, 1000 );

        let gl = [];
        let element = document.getElementById("main-canvas");
        const canvas =  element.children[0];
        for ( let name of [ "webgl", "experimental-webgl", "webkit-3d", "moz-webgl" ] )
            if (  gl = this.gl = canvas.getContext( name ) ) break;
        if   ( !gl ) throw "Canvas failed to make a WebGL context.";


        //Shadow mapping
        this.webgl_manager = context;      // Save off the Webgl_Manager object that created the scene.
        this.scratchpad = document.createElement('canvas');
        this.scratchpad.width   = 256;
        this.scratchpad.height  = 256;
        this.texture = new Texture ( context.gl, "", false, false );


        const shapes = { box:       new Cube(),
                         plane:     new Square(),
                         sphere6:   new Subdivision_Sphere(6),
                         pond:      new ( Circle.prototype.make_flat_shaded_version() ) ( 20, 20),
                         torus:     new Torus( 20, 20 ) ,
                         cylinder:  new Capped_Cylinder(20, 20),
                         tree_stem: new Shape_From_File( "assets/MapleTreeStem.obj" ),
                         tree_leaves: new Shape_From_File( "assets/MapleTreeLeaves.obj" ),
                         grass:     new Shape_From_File( "assets/Grass_03.obj"),
                         rock:      new Shape_From_File( "assets/Rock.obj"),
                        // house:     new Shape_From_File( "assets/house/home.obj"),
                         circle:    new Circle(),
                         mText:      new Text_Line(35),
                       }
        this.submit_shapes( context, shapes );
        this.shapes.mText.set_string("");

        this.materials =     
          { pond:          context.get_instance( Phong_Shader ).material( Color.of( 0, 123/255, 167/255, .5 ), { ambient: 0.3} ),
            ground:          context.get_instance( Fake_Bump_Map ).material( Color.of( 109/255, 78/255, 0/255, 1 ), { ambient: .40, texture: context.get_instance( "assets/ground_texture.jpeg", false ) } ),
            shadow:         context.get_instance(Shadow_Shader).material( Color.of( 71/255, 59/255, 51/255, 1 ), { ambient: 1, texture: this.texture } ),
            red:            context.get_instance( Phong_Shader ).material( Color.of( 1 ,0, 0 ,1 ), { ambient: 1 } ),
            green:          context.get_instance( Phong_Shader ).material( Color.of( 0 ,1, 0 ,1 ), { ambient: 1 } ),
            white:          context.get_instance( Phong_Shader ).material( Color.of( 1 ,1, 1 ,1 ), { ambient: 1 } ),
            tree_leaves:    context.get_instance( Fake_Bump_Map ).material( Color.of( 0,.6,0,1 ), { ambient: .7, diffusivity: .5, specularity: .5 } ),
            tree_stem:      context.get_instance( Fake_Bump_Map ).material( Color.of( 70/255, 50/255, 5/255,1 ), { ambient: .9, diffusivity: .5, specularity: .5 } ),
            rock:           context.get_instance( Fake_Bump_Map ).material( Color.of( 0.16, 0.16, 0.16,1 ), { ambient: .5, diffusivity: 5, specularity: .5 , texture: context.get_instance( "assets/rock_tex.jpg", false )  } ),
            //house:          context.get_instance( Phong_Shader ).material( Color.of( 0, 0, 0, 1 ), { ambient: 1} ),
            text_image:        context.get_instance( Phong_Shader ).material( Color.of( 0,0,0,1 ), { ambient: 1, diffusivity: 0, specularity: 0, texture: context.get_instance( "/assets/text.png", false ) } ),
          }

        this.lights = [ new Light( Vec.of( 0, 5, 40, 1 ), Color.of( 250/255,214/255,165/255,1 ), 1000 ) ];

        //We can add sounds here
        this.menu = new Audio("");
        this.menu.loop = true;
        //this.menu_volume = 0.5;


        this.backdrop_Matrix = Mat4.identity().times( Mat4.translation([0, 100, 1]))
                                              .times( Mat4.rotation( 1.6, Vec.of(1, 0, 0)))
                                              .times( Mat4.scale([ 200, 100, 1]));
        this.ground_Matrix = Mat4.identity();
        this.ground_Matrix = this.ground_Matrix.times( Mat4.translation([0, 0, 1]))
                                           .times( Mat4.scale([42.6, 42.6, .01]));                                           

        this.bottom_Matrix = Mat4.identity();
        this.bottom_Matrix = this.bottom_Matrix.times( Mat4.translation([0, 0, -1]))
                                           .times( Mat4.scale([15, 15, .01]))
                                           .times( Mat4.rotation(Math.PI, [1.3,0,0]) );
        this.tree_Matrix = Mat4.identity();
        this.tree_Matrix = this.tree_Matrix.times( Mat4.rotation( 1.6, Vec.of( 1, 0, 0)))
                                          .times( Mat4.translation([-13, 5.5, -7 ]))
                                           .times( Mat4.scale([1.5, 1.5, 1.5]));
        this.tree_Matrix2 = Mat4.identity();
        this.tree_Matrix2 = this.tree_Matrix2.times( Mat4.rotation( 1.6, Vec.of( 1, 0, 0)))
                                          .times( Mat4.translation([10, 2.2, -5 ]))
                                           .times( Mat4.scale([0.5, 0.5, 0.5]));

        this.tree_Matrix1 = this.tree_Matrix.times( Mat4.translation([21, -1.2, 0 ]))
                                            .times( Mat4.scale([0.5, 0.5, 0.5]));

        this.rock_Matrix = Mat4.identity().times( Mat4.rotation( 14.13, Vec.of( 1, 0, 0)))
                                          .times( Mat4.translation([ 22, 2.6, -20 ]))
                                          .times (Mat4.scale([15, 15, 15]));

         //this.house_Matrix = Mat4.identity().times( Mat4.rotation( 14.13, Vec.of( 1, 0, 0)))
                                     //   .times( Mat4.translation([ 0, 2.6, -20 ]))
                                      // .times (Mat4.scale([5, 5, 5]));

        this.ending_animation = false;
        this.beginning_animation = true;
        this.begin_animation = false;
        this.animation_t = 0;
        this.graphics_state = context.globals.graphics_state;
      }

    make_control_panel()
      {
        this.key_triggered_button( "start the scene", [ "m" ], () => { if(!this.begin_animation)
                                                                  this.graphics_state.camera_transform = Mat4.look_at( Vec.of( 0, -40, 30 ), Vec.of( 0, 0, 0 ), Vec.of( 0, 10, 0 ) );
                                                                  this.begin_animation = true;
                                                                  this.t_reset = false;
                                                                });
      }

     trigger_animation(graphics_state) {
          var desired = Mat4.look_at( Vec.of( 0, -20, 15 ), Vec.of( 0,0,0 ), Vec.of( 0,10, 0 ) );
          desired = desired.map((x, i) => Vec.from( graphics_state.camera_transform[i]).mix( x, .05));
          graphics_state.camera_transform = desired; 
          this.animation_t += 0.01;
        if (this.animation_t >= 1)
            this.beginning_animation = false;
     }

    // DISPLAY
    display( graphics_state )
      { 
        graphics_state.lights = this.lights;        
        const t = graphics_state.animation_time / 1000, dt = graphics_state.animation_delta_time / 1000;  
        this.time = t;
        if(this.beginning_animation && !this.ending_animation) {
              this.menu.play();
              if(!this.begin_animation)
              {
                  this.trigger_animation(graphics_state)

              }    
        }

        this.gl.depthMask(true);
        this.shapes.plane.draw( graphics_state, this.ground_Matrix, this.materials.ground);
        this.draw_the_enviroment(graphics_state, t);
      }

       //ENVIROMETNT

      draw_the_enviroment(graphics_state, t) {

        this.shapes.tree_stem.draw( graphics_state, this.tree_Matrix2, this.materials.tree_stem);
        this.shapes.tree_leaves.draw( graphics_state, this.tree_Matrix2, this.materials.tree_leaves);
        this.shapes.tree_stem.draw( graphics_state, this.tree_Matrix1, this.materials.tree_stem);
        this.shapes.tree_leaves.draw( graphics_state, this.tree_Matrix1, this.materials.tree_leaves.override( { color: Color.of( .3,.6,.2,1 )}));

        this.shapes.rock.draw( graphics_state, this.rock_Matrix, this.materials.rock);
        //this.shapes.house.draw(graphics_state, this.house_Matrix, this.materials.house);
        this.shapes.plane.draw( graphics_state, this.backdrop_Matrix, this.materials.pond.override( { color: Color.of( 147/255, 224/255, 1, 1), ambient: .8}));
      }

  };

class Texture_Scroll_X extends Phong_Shader
{ fragment_glsl_code()           
    {
      return `
        uniform sampler2D texture;
        void main()
        { if( GOURAUD || COLOR_NORMALS )    // Do smooth "Phong" shading unless options like "Gouraud mode" are wanted instead.di
          { gl_FragColor = VERTEX_COLOR;    // Otherwise, we already have final colors to smear (interpolate) across vertices.            
            return;
          }                                 // If we get this far, calculate Smooth "Phong" Shading as opposed to Gouraud Shading.
                                            // Phong shading is not to be confused with the Phong Reflection Model.
          vec2 mVector = f_tex_coord; 
          mat4 mMatrix = mat4(vec4(1., 0., 0., 0.), vec4(0., 1., 0., 0.), vec4( 0., 0., 1., 0.), vec4( mod(2.0 * animation_time, 88.) , 0., 0., 1.)); 
          vec4 tempVector = vec4(mVector, 0, 0); 
          tempVector = tempVector + vec4(1., 1., 0., 1.); 
          tempVector = mMatrix * tempVector; 

          vec4 tex_color = texture2D( texture, tempVector.xy );                         // Sample the texture image in the correct place.
                                                                                      // Compute an initial (ambient) color:
          if( USE_TEXTURE ) gl_FragColor = vec4( ( tex_color.xyz + shapeColor.xyz ) * ambient, shapeColor.w * tex_color.w ); 
          else gl_FragColor = vec4( shapeColor.xyz * ambient, shapeColor.w );
          gl_FragColor.xyz += phong_model_lights( N );                     // Compute the final color with contributions from lights.
        }`;
    }
}

class Texture_Rotate extends Phong_Shader
{ fragment_glsl_code()          
    {
      return `
        uniform sampler2D texture;
        void main()
        { if( GOURAUD || COLOR_NORMALS )    // Do smooth "Phong" shading unless options like "Gouraud mode" are wanted instead.
          { gl_FragColor = VERTEX_COLOR;    // Otherwise, we already have final colors to smear (interpolate) across vertices.            
            return;
          }                                 // If we get this far, calculate Smooth "Phong" Shading as opposed to Gouraud Shading.
                                            // Phong shading is not to be confused with the Phong Reflection Model.

          vec2 mVector = f_tex_coord; 
          mat4 mMatrix = mat4(cos( mod((6.28) * .25 * animation_time, 44. * 3.14)), sin( mod((6.28) * .25 * animation_time, 44. * 3.14)), 0, 0, -sin( mod((6.28) * .25 * animation_time, 44. * 3.14)), cos( mod((6.28) * .25 * animation_time, 44. * 3.14)), 0, 0, 0, 0, 1, 0, 0, 0, 0, 1);
          vec4 tempVector = vec4(mVector, 0, 0); 
          tempVector = tempVector + vec4(-.5, -.5, 0., 0.);
          tempVector = mMatrix * tempVector; 
          tempVector = tempVector + vec4(.5, .5, 0., 0.);
          
          vec4 tex_color = texture2D( texture, tempVector.xy );                         // Sample the texture image in the correct place.
                                                                                      // Compute an initial (ambient) color:
          if( USE_TEXTURE ) gl_FragColor = vec4( ( tex_color.xyz + shapeColor.xyz ) * ambient, shapeColor.w * tex_color.w ); 
          else gl_FragColor = vec4( shapeColor.xyz * ambient, shapeColor.w );
          gl_FragColor.xyz += phong_model_lights( N );                     // Compute the final color with contributions from lights.
        }`;
    }
}


