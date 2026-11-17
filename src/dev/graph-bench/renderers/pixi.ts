import {
  Application,
  Container,
  Graphics,
  Particle,
  ParticleContainer,
} from "pixi.js";
import {
  EDGE_ALPHA,
  EDGE_COLOR,
  fit,
  NODE_COLOR,
  NODE_RADIUS,
  type RendererFactory,
} from "./renderer";

/**
 * Pixi.js on WebGL: the edges are one `Graphics` built once, the nodes
 * particles of one circle texture. A frame only moves the camera.
 */
export const pixiRenderer: RendererFactory = async (
  container,
  graph,
  positions,
) => {
  const width = container.clientWidth;
  const height = container.clientHeight;
  const app = new Application();
  await app.init({
    width,
    height,
    preference: "webgl",
    antialias: true,
    backgroundAlpha: 0,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true,
    autoStart: false,
    sharedTicker: false,
  });
  app.ticker.stop();
  container.append(app.canvas);

  const world = new Container();
  app.stage.addChild(world);

  const lines = new Graphics();
  const { edges } = graph;
  for (let i = 0; i < edges.length; i += 2) {
    const a = edges[i] * 2;
    const b = edges[i + 1] * 2;
    lines.moveTo(positions[a], positions[a + 1]);
    lines.lineTo(positions[b], positions[b + 1]);
  }
  lines.stroke({
    color: EDGE_COLOR,
    alpha: EDGE_ALPHA,
    width: 1,
    pixelLine: true,
  });
  world.addChild(lines);

  const dot = new Graphics().circle(0, 0, NODE_RADIUS * 4).fill(0xffffff);
  const texture = app.renderer.generateTexture(dot);
  const nodes = new ParticleContainer({
    dynamicProperties: { position: false },
  });
  for (let i = 0; i < graph.titles.length; i++) {
    nodes.addParticle(
      new Particle({
        texture,
        x: positions[i * 2],
        y: positions[i * 2 + 1],
        anchorX: 0.5,
        anchorY: 0.5,
        scaleX: 0.25,
        scaleY: 0.25,
        tint: NODE_COLOR,
      }),
    );
  }
  world.addChild(nodes);

  const base = fit(positions, width, height);
  return {
    setView(view) {
      const scale = base.scale * view.zoom;
      world.scale.set(scale);
      world.position.set(
        width / 2 - view.x * scale,
        height / 2 - view.y * scale,
      );
      app.render();
    },
    destroy() {
      app.destroy(true, { children: true });
      texture.destroy(true);
    },
  };
};
