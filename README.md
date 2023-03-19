# viewer-align

# WORK IN PROGRESS

## Introduction

This sample demonstrates a way to align and transform two models in the same scene. Maybe you have each discipline coming from a different source format, softwares or designed in a way that they don't simply align with each other when loaded in the same scene. This sample will show how you can take advantage of common points from different models in order to align them.

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

Each model is oriented in its own way, that might seem "wrong"when compared with each other.

![misaligned models]()

We need to find common points in the models that will serve as references for alignment.

### - Defining the common points for rotation

To align the models in regards to rotation, we need 3 points for each of them, that we can refer as points from 1 to 6.

- 1 to 3 from model A (non-colinear)
- 4 to 6 from model B (non-colinear)

![6 points taken]()

These points can be used to define which rotations we'll need to perform in order to align our models.

From these points we can have 4 vectors:

- v12 from model A
- v23 from model A
- v45 from model B
- v56 from model B

![4 vectors from 6 points]()

First rotation is done through the axis of the vectorial product between v12 and v45, by the lesser angle formed between them.

![first rotation from vectors]()

Second rotation is done through the axis of the vectorial product between v23 and v56, by the lesser angle formed between them.  

![second rotation from vectors]()

From these angles and axis, we can define our rotation matrices with the function below:

```js
findRotationMatrix(firstVector, secondVector) {
  let rotationAxis = (new THREE.Vector3()).crossVectors(firstVector, secondVector).normalize();
  let rotationAngle = firstVector.angleTo(secondVector);
  return (new THREE.Matrix4()).makeRotationAxis(rotationAxis, rotationAngle);
}
```

We just need to be aware that by the time we apply the second rotation, the first rotation would already be applied, so we need to apply the first rotation matrix on the points moved before defining the second rotation matrix.

```js
//First rotation
let firstRotationMatrix = this.findRotationMatrix(this.points[this.transformingModelId][1].clone().sub(this.points[this.transformingModelId][0]), this.points[fixedModelId][1].clone().sub(this.points[fixedModelId][0]));

//Second rotation
let secondRotationMatrix = this.findRotationMatrix(this.points[this.transformingModelId][2].clone().applyMatrix4(firstRotationMatrix).sub(this.points[this.transformingModelId][1].clone().applyMatrix4(firstRotationMatrix)), this.points[fixedModelId][2].clone().sub(this.points[fixedModelId][1].clone()));
```

With that, we can obtain a single matrix containing the two rotations that can be applied to the model:

```js
let fullRotationMatrix = firstRotationMatrix.clone().multiply(secondRotationMatrix);
```

And before 

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

![synced viewer](./assets/synced_viewer.gif)

Also note that for two specific models, this needs to be done **only in the first loading**. After the first alignment, you can store the required information such as matices and vectors in an external DB to be loaded every time the models are compared.
