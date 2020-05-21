async function getSteps(existingStepsMap) {
  const steps = new Map([
    ...existingStepsMap,
    // TODO: Add your other post deployment steps here
    // Example: ['yourStepServiceName', new StepImplementationService()],
  ]);
  return steps;
}

const plugin = {
  getSteps,
};

module.exports = plugin;
