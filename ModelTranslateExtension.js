const ModelTranslateToolName = 'modeltranslate-tool';

class ModelTranslateTool extends Autodesk.Viewing.ToolInterface {
  constructor(viewer, options) {
    super();
    this.viewer = viewer;
    this.names = [ModelTranslateToolName];
    this.active = false;
    this.snapper = null;
    this.points = {};
    // Hack: delete functions defined on the *instance* of a ToolInterface (we want the tool controller to call our class methods instead)
    delete this.register;
    delete this.deregister;
    delete this.activate;
    delete this.deactivate;
    delete this.getPriority;
    delete this.handleMouseMove;
    delete this.handleSingleClick;
    delete this.handleKeyUp;
  }

  register() {
    this.snapper = new Autodesk.Viewing.Extensions.Snapping.Snapper(this.viewer, { renderSnappedGeometry: false, renderSnappedTopology: false });
    this.viewer.toolController.registerTool(this.snapper);
    this.viewer.toolController.activateTool(this.snapper.getName());
    console.log('ModelTranslateTool registered.');
  }

  deregister() {
    this.viewer.toolController.deactivateTool(this.snapper.getName());
    this.viewer.toolController.deregisterTool(this.snapper);
    this.snapper = null;
    console.log('ModelTranslateTool unregistered.');
  }

  activate(name, viewer) {
    if (!this.active) {
      console.log('ModelTranslateTool activated.');
      this.active = true;

      this.prepareDataViz();
    }
  }

  async prepareDataViz() {
    this.dataVizExtn = this.viewer.getExtension("Autodesk.DataVisualization");
    let DataVizCore = Autodesk.DataVisualization.Core;
    this.viewableData = new DataVizCore.ViewableData();
    this.viewableData.spriteSize = 32; // Sprites as points of size 24 x 24 pixels
    let viewableType = DataVizCore.ViewableType.SPRITE;

    let pointsColor = new THREE.Color(0xffffff);

    let firstPointIconUrl = "https://img.icons8.com/ios/50/null/1-circle.png";
    let secondPointIconUrl = "https://img.icons8.com/ios/50/null/2-circle.png";

    this.pointStyles = [
      new DataVizCore.ViewableStyle(viewableType, pointsColor, firstPointIconUrl),
      new DataVizCore.ViewableStyle(viewableType, pointsColor, secondPointIconUrl)
    ];
  }

  deactivate(name) {
    if (this.active) {
      console.log('ModelTranslateTool deactivated.');
      this.active = false;
    }
  }

  getPriority() {
    return 13; // Feel free to use any number higher than 0 (which is the priority of all the default viewer tools)
  }

  handleMouseMove(event) {
    if (!this.active) {
      return false;
    }

    this.snapper.indicator.clearOverlays();
    if (this.snapper.isSnapped()) {
      this.viewer.clearSelection();
      const result = this.snapper.getSnapResult();
      const { SnapType } = Autodesk.Viewing.MeasureCommon;
      this.snapper.indicator.render(); // Show indicator when snapped to a vertex
    }
    return false;
  }

  handleSingleClick(event, button) {
    if (!this.active) {
      return false;
    }

    if (button === 0 && this.snapper.isSnapped()) {
      const result = this.snapper.getSnapResult();
      const { SnapType } = Autodesk.Viewing.MeasureCommon;
      if (!this.points[result.modelId]) {
        this.points[result.modelId] = [];
      }
      this.points[result.modelId].push(result.intersectPoint.clone());
      let addedPointIndex = this.points[result.modelId].length - 1;
      let addedPoints = Object.values(this.points).flat().length;
      this.renderSprite(this.points[result.modelId][addedPointIndex], addedPoints + 10000, addedPoints - 1);

      switch (addedPoints) {
        case 1:
          this.transformingModelId = result.modelId;
          break;
        case 2:
          this.updatePoints();
          this.resetPoints();
          return true; // Stop the event from going to other tools in the stack
        default:
          break;
      }
    }
    return false;
  }

  arePointsCoplanar() {
    let v12 = this.points[1].clone().sub(this.points[0]);
    let v13 = this.points[2].clone().sub(this.points[0]);
    return Math.abs(v12.cross(v13).dot(v14)) < 0.0001;
  }

  handleKeyUp(event, keyCode) {
    if (this.active) {
      if (keyCode === 27) {
        this.points = [];
        return true;
      }
    }
    return false;
  }

  updatePoints() {

    let modelToTransform = this.viewer.getAllModels().find(m => m.id === this.transformingModelId);
    let fixedModelId = this.transformingModelId === 1 ? 2 : 1;

    let translationVector = this.points[fixedModelId][0].clone().sub(this.points[this.transformingModelId][0]);

    let transformationMatrix;
    let auxTransform = modelToTransform.getModelTransform();
    if (!!auxTransform) {
      auxTransform.elements[12] += translationVector.x;
      auxTransform.elements[13] += translationVector.y;
      auxTransform.elements[14] += translationVector.z;
      transformationMatrix = auxTransform;
    }
    else {
      transformationMatrix = (new THREE.Matrix4()).makeTranslation(translationVector.x, translationVector.y, translationVector.z);
    }

    modelToTransform.setModelTransform(transformationMatrix);
  }

  resetPoints() {
    this.points = {};
  }

  clearSprites() {
    this.resetPoints();
    this.dataVizExtn.removeAllViewables();
  }

  renderSprite(spritePosition, dbId, pointIndex) {
    let DataVizCore = Autodesk.DataVisualization.Core;
    const viewable = new DataVizCore.SpriteViewable(spritePosition, this.pointStyles[pointIndex], dbId);
    this.viewableData.addViewable(viewable);

    this.viewableData.finish().then(() => {
      this.dataVizExtn.addViewables(this.viewableData);
    });
  }

}

class ModelTranslateExtension extends Autodesk.Viewing.Extension {
  constructor(viewer, options) {
    super(viewer, options);
    this._button = null;
    this.tool = new ModelTranslateTool(viewer);
    this._onObjectTreeCreated = (ev) => this.onModelLoaded(ev.model);
  }

  async onModelLoaded(model) {
    this.dataVizExtn = await this.viewer.getExtension("Autodesk.DataVisualization");
  }

  async load() {
    await this.viewer.loadExtension('Autodesk.Snapping');
    this.viewer.toolController.registerTool(this.tool);
    this.viewer.addEventListener(Autodesk.Viewing.OBJECT_TREE_CREATED_EVENT, this._onObjectTreeCreated);
    return true;
  }

  unload() {
    if (this._button) {
      this.removeToolbarButton(this._button);
      this._button = null;
    }
    return true;
  }

  onToolbarCreated() {
    const controller = this.viewer.toolController;
    this._button = this.createToolbarButton('modeltranslateextension-button', 'https://img.icons8.com/pastel-glyph/30/null/move.png', 'Translate model based on two points');
    this._button.onClick = () => {
      if (controller.isToolActivated(ModelTranslateToolName)) {
        controller.deactivateTool(ModelTranslateToolName);
        this.tool.clearSprites();
        this._button.setState(Autodesk.Viewing.UI.Button.State.INACTIVE);
      } else {
        controller.activateTool(ModelTranslateToolName);
        this._button.setState(Autodesk.Viewing.UI.Button.State.ACTIVE);
      }
    };
  }

  createToolbarButton(buttonId, buttonIconUrl, buttonTooltip) {
    let group = this.viewer.toolbar.getControl('modeltransformation-toolbar-group');
    if (!group) {
      group = new Autodesk.Viewing.UI.ControlGroup('modeltransformation-toolbar-group');
      this.viewer.toolbar.addControl(group);
    }
    const button = new Autodesk.Viewing.UI.Button(buttonId);
    button.setToolTip(buttonTooltip);
    group.addControl(button);
    const icon = button.container.querySelector('.adsk-button-icon');
    if (icon) {
      icon.style.backgroundImage = `url(${buttonIconUrl})`;
      icon.style.backgroundSize = `24px`;
      icon.style.backgroundRepeat = `no-repeat`;
      icon.style.backgroundPosition = `center`;
    }
    return button;
  }

  removeToolbarButton(button) {
    const group = this.viewer.toolbar.getControl('modeltransformation-toolbar-group');
    group.removeControl(button);
  }
}

Autodesk.Viewing.theExtensionManager.registerExtension('ModelTranslateExtension', ModelTranslateExtension);