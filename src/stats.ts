// eslint-disable-next-line
// @ts-ignore
import ThreeStatsModule from 'three/examples/jsm/libs/stats.module';

/**
 * The shipped stats.module.js and its @types/three declaration disagree, and the runtime is
 * the one that is right: the module returns an object exposing `domElement`, and `Stats.Panel`
 * is a plain function that works without `new`. The declaration describes neither, so `tsc`
 * reports eleven errors against code that runs correctly -- which is why `npm run build`
 * failed while `npm run dev` was fine. Describe the real shape rather than fight it.
 */
interface StatsPanel {
  update(value: number, maxValue: number): void;
}

interface StatsInstance {
  domElement: HTMLElement;
  addPanel(panel: StatsPanel): StatsPanel;
  update(): void;
}

const ThreeStats = ThreeStatsModule as unknown as {
  new (): StatsInstance;
  Panel(name: string, fg: string, bg: string): StatsPanel;
};

export class Stats {
  domElement = document.createElement('div');

  private readonly stats = new ThreeStats();
  private readonly panels: StatsPanel[] = [];
  private beginTime = 0;

  constructor(private readonly renderer: THREE.WebGLRenderer) {
    this.domElement.id = 'render-stats';

    this.stats.domElement.style.position = 'absolute';
    this.stats.domElement.style.display = 'flex';
    this.stats.domElement.style.flexDirection = 'column';
    this.domElement.appendChild(this.stats.domElement);

    const msPanel = ThreeStats.Panel('Delta', '#0f0', '#020');
    this.stats.addPanel(msPanel);
    this.panels.push(msPanel);

    const callsPanel = ThreeStats.Panel('Draw Calls', '#ff0', '#220');
    this.stats.addPanel(callsPanel);
    this.panels.push(callsPanel);

    const programsPanel = ThreeStats.Panel('Programs', '#ff0', '#220');
    this.stats.addPanel(programsPanel);
    this.panels.push(programsPanel);

    const geometriesPanel = ThreeStats.Panel('Geometries', '#ff0', '#220');
    this.stats.addPanel(geometriesPanel);
    this.panels.push(geometriesPanel);

    const pointsPanel = ThreeStats.Panel('Points', '#f08', '#201');
    this.stats.addPanel(pointsPanel);
    this.panels.push(pointsPanel);

    const linesPanel = ThreeStats.Panel('Lines', '#f08', '#201');
    this.stats.addPanel(linesPanel);
    this.panels.push(linesPanel);

    const trisPanel = ThreeStats.Panel('Tris', '#f08', '#201');
    this.stats.addPanel(trisPanel);
    this.panels.push(trisPanel);
  }

  update(dt: number) {
    this.stats.update();
    this.panels[0]?.update(dt, 200);
    this.panels[1]?.update(this.renderer.info.render.calls, 2);
    this.panels[2]?.update(this.renderer.info.programs?.length || 0, 10);
    this.panels[3]?.update(this.renderer.info.memory.geometries, 2);
    this.panels[4]?.update(this.renderer.info.render.points, 200000);
    this.panels[5]?.update(this.renderer.info.render.lines, 200000);
    this.panels[6]?.update(this.renderer.info.render.triangles, 200000);
  }

  begin() {
    this.beginTime = performance.now();
  }

  end() {
    const elapsedTime = performance.now() - this.beginTime;
    this.update(elapsedTime);
  }
}
