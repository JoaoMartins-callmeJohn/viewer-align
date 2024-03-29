# viewer-align

# WORK IN PROGRESS

## Introduction

This sample demonstrates a way to align and transform two models in the same scene. Maybe you have each discipline coming from a different source format, softwares or designed in a way that they don't simply align with each other when loaded in the same scene. This sample will show how you can take advantage of common points from different models in order to align them.

TRY AT https://joaomartins-callmejohn.github.io/viewer-align/

## Premises

As our base assumption for this sample, we're going to assume that the models are compatible, i.e they refer to the same context, differing in positioning and/or rotation. We aren't handling rotation in this example to simplify our workflow, but it can easily be addressed using similar logic.

Our challenge will be on finding a way to adjust the two models in the same scene. Lets suppose we have two models refering to the same project/context: If the models are compatible, they can be oriented in a way to complete each other in an aggregated scene.

## How to find the equivalence?

Considering that the models can have any orientation and positioning in the scene, we need to address these differences.

- First of them is rotation, as the models can be misaligned.

- The other transformation that we need to consider is regarding translation, so they stay compatible

With a combination of all these conversions (rotation and translation) we can align the two models in the scene.

## The math behind the Alignment

Before jumping into the math for our calculations, lets begin with some contextualization.

Each model is oriented in its own way, that might seem "wrong" when compared with each other.

![misaligned models](./assets/misaligned_models.png)

We need to find common points in the models that will serve as references for alignment.

### - Defining the common points for rotation

To align the models in regards to rotation, we need 3 points for each of them, that we can refer as points from 1 to 6.

- 1 to 3 from model A (non-colinear)
- 4 to 6 from model B (non-colinear)

![6 points taken](./assets/6_points_taken.png)

These points can be used to define which rotations we'll need to perform in order to align our models.

We can define the proper rotation matrix as the transformation between arbitrary "bases" of our models. If we use normalized vector as axis of those basis, we won't have distorion/scaling, and all this transformation will do is rotate our models.

First basis (for the rotating model) is defined by the three axis below:

1. The vector from point 1 to point 2 (normalized)
2. The height of the triangle formed by points 1, 2, and 3 relative to the base formed by points 1 and 2 (normalized)
3. The vector product from axis 1 and axis 2 (normalized)

Just like in the image below:

![first model basis](./assets/first_model_basis.png)

Second basis is defined using the same logic, but this time for the fixed model. Instead of points 1, 2, and 3 we'll have points 4, 5, and 6. 

With that, we'll have asnippet just like the one below:

```js
let modelToTransform = this.viewer.getAllModels().find(m => m.id === this.transformingModelId);
let fixedModelId = this.transformingModelId === 1 ? 2 : 1;

//Transforming model basis
let transformingModelAxis1 = this.points[this.transformingModelId][1].clone().sub(this.points[this.transformingModelId][0]).normalize();
let line12 = new THREE.Line3(this.points[this.transformingModelId][0], this.points[this.transformingModelId][1]);
let auxPoint = new THREE.Vector3();
line12.closestPointToPoint(this.points[this.transformingModelId][2], false, auxPoint);
let transformingModelAxis2 = this.points[this.transformingModelId][2].clone().sub(auxPoint).normalize();
let transformingModelAxis3 = (new THREE.Vector3()).crossVectors(transformingModelAxis1, transformingModelAxis2).normalize();
let transformingModelBasis = (new THREE.Matrix4()).makeBasis(transformingModelAxis1, transformingModelAxis2, transformingModelAxis3);

//Fixed model basis
let fixedModelAxis1 = this.points[fixedModelId][1].clone().sub(this.points[fixedModelId][0]).normalize();
let line45 = new THREE.Line3(this.points[fixedModelId][0], this.points[fixedModelId][1]);
let auxPoint2 = new THREE.Vector3();
line45.closestPointToPoint(this.points[fixedModelId][2], false, auxPoint2);
let fixedModelAxis2 = this.points[fixedModelId][2].clone().sub(auxPoint2).normalize();
let fixedModelAxis3 = (new THREE.Vector3()).crossVectors(fixedModelAxis1, fixedModelAxis2).normalize();
let fixedModelBasis = (new THREE.Matrix4()).makeBasis(fixedModelAxis1, fixedModelAxis2, fixedModelAxis3);

let fullRotationMatrix = (new THREE.Matrix4()).multiplyMatrices(fixedModelBasis, transformingModelBasis.transpose());;

let existingTransform = modelToTransform.getModelTransform();

let transformationMatrix;
if (!!existingTransform) {
  transformationMatrix = existingTransform.clone().multiply(fullRotationMatrix);
}
else {
  transformationMatrix = fullRotationMatrix;
}

modelToTransform.setModelTransform(transformationMatrix);
```

With that, we take care of the proper alignment between the two models.

### - Defining the common points for translation

For translation it's quite simple.

We just need two points, and the translation will be the difference between them, just like in the snippet bellow:

```js
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
```

## Putting everything together

For any transformation that we need to apply, there's a order we have to obey:

- Define transformation matrices from picked points
- Obtain the current transformation from the model that we will rotate/translate
- Add our transformation matrix to the acquired model transform
- Apply modified transformation matrix to the model

With all of that together, we can align the two models in the scene smoothly.

Covering rotation:

![aligned models rotation](./assets/aligned_models_rotation.gif)

And translation:

![aligned models translation](./assets/aligned_models_translation.gif)

Also note that for two specific models, this needs to be done **only in the first loading**. After the first alignment, you can store the required information such as matices and vectors in an external DB to be loaded every time the models are compared.
