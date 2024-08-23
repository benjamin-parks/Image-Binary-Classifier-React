import * as tf from '@tensorflow/tfjs';

let model = null;

self.onmessage = async (event) => {
  if (event.data.command === 'train') {
    const { yesData, noData } = event.data;

    // Create a Sequential model
    model = tf.sequential();
    model.add(tf.layers.dense({ units: 64, inputShape: [3], activation: 'relu' }));
    model.add(tf.layers.dense({ units: 32, activation: 'relu' }));
    model.add(tf.layers.dense({ units: 16, activation: 'relu' }));
    model.add(tf.layers.dense({ units: 8, activation: 'relu' }));
    model.add(tf.layers.dense({ units: 2, activation: 'softmax' }));

    model.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'categoricalCrossentropy',
      metrics: ['accuracy'],
    });

    const yesLabels = tf.tensor2d(Array(yesData.length).fill([1, 0]), [yesData.length, 2]);
    const noLabels = tf.tensor2d(Array(noData.length).fill([0, 1]), [noData.length, 2]);
    const inputs = tf.tensor2d([...yesData, ...noData], [yesData.length + noData.length, 3]);
    const labels = tf.concat([yesLabels, noLabels]);

    await model.fit(inputs, labels, {
      epochs: 100,
      shuffle: true,
      callbacks: {
        onEpochEnd: (epoch, logs) => {
          if (epoch % 10 === 0) {
            console.log(`Epoch ${epoch}: ${logs.loss}`);
          }
        },
      },
    });

    self.postMessage({ command: 'trainingComplete' });
  } else if (event.data.command === 'inference') {
    if (!model) {
      console.error('Model not trained or loaded');
      return;
    }

    const { imageData, width, height } = event.data;
    const binaryImageData = new Uint8Array(width * height);

    for (let i = 0; i < width * height; i++) {
      const r = imageData[i * 4] / 255;
      const g = imageData[i * 4 + 1] / 255;
      const b = imageData[i * 4 + 2] / 255;

      const prediction = model.predict(tf.tensor2d([[r, g, b]], [1, 3]));
      const probabilities = prediction.dataSync();

      binaryImageData[i] = probabilities[0] > 0.5 ? 1 : 0;

      tf.dispose(prediction);
    }

    self.postMessage({ command: 'inferenceComplete', binaryImageData });
  }
};
