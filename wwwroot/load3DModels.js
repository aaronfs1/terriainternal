console.log("✅ load3DModels.js script is running...");

// Use your *actual* Cesium Ion token here:
Cesium.Ion.defaultAccessToken =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJhZjZjMDliMC04MDQ3LTRhMWQtYmI4ZC1hOTQ2NzJmYTUyYzUiLCJpZCI6MjQ3MDE2LCJpYXQiOjE3Mzk0Mjk0NjB9.d7CmmzSJzF4xYG24dvZ76GjJVQL-0DiTihjq4bzdYxY";

const customgeoJsonAssetId = 3121093;
const baseModelAssetId = 3124907;

let firstAntennaPosition = null;
const processedSiteIds = new Set();

document.addEventListener("DOMContentLoaded", async () => {
  console.log("⏳ Waiting for TerriaMap...");
  const waitForTerria = setInterval(async () => {
    if (window.terria && window.terria.currentViewer?.scene?.primitives) {
      clearInterval(waitForTerria);
      console.log("✅ TerriaMap instance is ready:", window.terria);
      loadGeoJSONAndPlaceModels(window.terria);
    } else {
      console.warn(
        "⏳ Waiting for TerriaMap... terria or scene primitives not ready."
      );
    }
  }, 500);
});

async function loadGeoJSONAndPlaceModels(terria) {
  console.log("📡 Fetching GeoJSON and adding base models...");
  try {
    window.geoJsonData = await Cesium.IonResource.fromAssetId(
      customgeoJsonAssetId
    ).then((res) => res.fetchJson());
    console.log("✅ GeoJSON Data is globally accessible:", window.geoJsonData);

    console.log("✅ GeoJSON Data Loaded:", geoJsonData);

    if (!terria.currentViewer?.scene?.primitives) {
      console.error(
        "❌ Terria's scene primitives is not available. Cannot proceed."
      );
      return;
    }

    console.log("🛠️ terria.currentViewer.scene.primitives is available.");

    // ✅ Make flyToSiteID globally accessible
    window.flyToSiteID = function (siteID) {
      console.log(`🚀 flyToSiteID triggered for: ${siteID}`);

      if (!window.geoJsonData) {
        console.error("❌ GeoJSON data is not loaded yet.");
        return;
      }

      console.log("🔍 Searching for site in GeoJSON...");
      const siteFeature = window.geoJsonData.features.find(
        (feature) =>
          feature.properties["siteid"].toString().toUpperCase() ===
          siteID.toUpperCase()
      );

      if (!siteFeature) {
        console.warn(`⚠️ Site ID ${siteID} not found in GeoJSON.`);
        return;
      }

      const [longitude, latitude] = siteFeature.geometry.coordinates;
      console.log(`📍 Site Found! Lat: ${latitude}, Lon: ${longitude}`);

      if (
        !window.terria ||
        !window.terria.currentViewer ||
        !window.terria.currentViewer.scene
      ) {
        console.error("❌ Cesium scene is not ready.");
        return;
      }

      console.log("🎥 Flying camera to site...");
      window.terria.currentViewer.scene.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(longitude, latitude, 1000), // Adjust altitude for better top-down view
        duration: 2,
        orientation: {
          heading: Cesium.Math.toRadians(0),
          pitch: Cesium.Math.toRadians(-90), // Looking straight down
          roll: 0
        }
      });
      console.log("✅ Camera movement triggered!");
    };

    for (const feature of geoJsonData.features) {
      const { geometry, properties } = feature;
      const [longitude, latitude] = geometry.coordinates;
      const siteId = properties["siteid"];

      if (processedSiteIds.has(siteId)) {
        console.log(`⚠️ Site ID ${siteId} already processed. Skipping...`);
        continue;
      }
      processedSiteIds.add(siteId);

      const terrainHeight = await getTerrainHeight(longitude, latitude);

      console.log(
        `📍 Antenna Added | Site ID: ${siteId} | Lat: ${latitude}, Lon: ${longitude} | Terrain Height: ${terrainHeight}m`
      );

      // ✅ Place the model **directly at** terrain height (no extra offsets)
      const position = Cesium.Cartesian3.fromDegrees(
        longitude,
        latitude,
        terrainHeight
      );
      const modelMatrix = Cesium.Transforms.eastNorthUpToFixedFrame(position);

      if (!firstAntennaPosition) {
        firstAntennaPosition = { longitude, latitude, height: terrainHeight };
      }

      try {
        const modelResource = await Cesium.IonResource.fromAssetId(
          baseModelAssetId
        );
        console.log("🔍 Model Resource Validated:", modelResource);

        const modelEntity = Cesium.Model.fromGltf({
          url: modelResource,
          modelMatrix: modelMatrix,
          scale: 1 // No scaling needed
        });

        terria.currentViewer.scene.primitives.add(modelEntity);
        console.log("✅ Model added successfully");
      } catch (error) {
        console.error("❌ Failed to load model:", error);
      }
    }

    console.log("✅ Base models successfully added.");
    if (firstAntennaPosition) {
      flyToFirstAntenna(terria, firstAntennaPosition);
    }
  } catch (error) {
    console.error("❌ Error adding base models:", error);
  }
}

// ✅ FIX: Get Terrain Height Using Cesium Terrain Provider ONLY (No Offsets)
async function getTerrainHeight(longitude, latitude) {
  const scene = window.terria?.currentViewer?.scene;
  if (!scene) {
    console.error("❌ Scene is not available.");
    return 0; // No fallback height, ensure it's on ground level
  }

  const terrainProvider = scene.terrainProvider;
  const positions = [Cesium.Cartographic.fromDegrees(longitude, latitude)];

  try {
    const heights = await Cesium.sampleTerrainMostDetailed(
      terrainProvider,
      positions
    );
    return heights[0]?.height || 0; // No artificial offset
  } catch (error) {
    console.warn(
      "⚠️ Failed to sample terrain. Setting antenna exactly on ground."
    );
    return 0;
  }
}

function flyToFirstAntenna(terria, position) {
  terria.currentViewer.scene.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(
      position.longitude,
      position.latitude,
      Math.max(position.height + 50, 100)
    ),
    duration: 3,
    orientation: { heading: 0, pitch: -0.5, roll: 0 }
  });
}
