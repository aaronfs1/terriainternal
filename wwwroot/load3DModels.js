/* global Cesium */

console.log("✅ load3DModels.js script is running...");

// Tokens
const siteGeoJsonAssetId = 3121093;
const siteAccessToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJhZjZjMDliMC04MDQ3LTRhMWQtYmI4ZC1hOTQ2NzJmYTUyYzUiLCJpZCI6MjQ3MDE2LCJpYXQiOjE3Mzk0Mjk0NjB9.d7CmmzSJzF4xYG24dvZ76GjJVQL-0DiTihjq4bzdYxY";

const ticketGeoJsonAssetId = 3330579;
const ticketAccessToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI4MGYxODE5YS1mYTA4LTRmMTQtODNjMC0xMDc0ODNmODRmYzMiLCJpZCI6Mjk0MTA5LCJpYXQiOjE3NDU3MzkwNzN9.UNRFdlSDd4YDBCeEHkN_o1NQD7thLHPgPc97eYEa4-8";

const siteIdAssetId = 3374925;
const siteIdAccessToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiIxYTQzMGJmNS03N2VjLTQ2MWMtOGVjZC1lZTdhNzdjMTAzNTkiLCJpZCI6Mjk0MTA5LCJpYXQiOjE3NDcxNDYzOTl9.ayGRfH5quHXV33UToFnG87aq2CJs6x5T7fCc-UniOMU";

let firstAntennaPosition = null;
const processedSiteIds = new Set();

document.addEventListener("DOMContentLoaded", async () => {
  console.log("⏳ Waiting for TerriaMap...");
  const waitForTerria = setInterval(async () => {
    if (window.terria && window.terria.currentViewer?.scene?.primitives) {
      clearInterval(waitForTerria);
      console.log("✅ TerriaMap instance is ready:", window.terria);
      await loadSiteGeoJSON(window.terria);
      await loadTicketGeoJSON();
      await loadSiteIdGeoJSON(); // ✅ Ensure new dataset is loaded too
    }
  }, 500);
});

// Load New Site ID GeoJSON
async function loadSiteIdGeoJSON() {
  console.log("📡 Fetching SiteID GeoJSON...");
  try {
    Cesium.Ion.defaultAccessToken = siteIdAccessToken;
    window.siteIdGeoJsonData = await Cesium.IonResource.fromAssetId(siteIdAssetId).then(res => res.fetchJson());
    console.log("✅ SiteID GeoJSON loaded.");
  } catch (error) {
    console.error("❌ Error loading SiteID GeoJSON:", error);
  }
}

// Load Site GeoJSON (legacy Cell ID dataset)
async function loadSiteGeoJSON(terria) {
  console.log("📡 Fetching Site GeoJSON...");
  try {
    Cesium.Ion.defaultAccessToken = siteAccessToken;
    window.siteGeoJsonData = await Cesium.IonResource.fromAssetId(siteGeoJsonAssetId).then(res => res.fetchJson());
    console.log("✅ Site GeoJSON loaded.");

    if (!terria.currentViewer?.scene?.primitives) {
      console.error("❌ Scene primitives unavailable.");
      return;
    }

    for (const feature of siteGeoJsonData.features) {
      const { geometry, properties } = feature;
      const [longitude, latitude] = geometry.coordinates;
      const siteId = properties["siteid"];
      if (processedSiteIds.has(siteId)) continue;
      processedSiteIds.add(siteId);

      const terrainHeight = await getTerrainHeight(longitude, latitude);
      const position = Cesium.Cartesian3.fromDegrees(longitude, latitude, terrainHeight);
      const modelMatrix = Cesium.Transforms.eastNorthUpToFixedFrame(position);

      try {
        const modelResource = await Cesium.IonResource.fromAssetId(3124907);
        const modelEntity = Cesium.Model.fromGltf({ url: modelResource, modelMatrix, scale: 1 });
        terria.currentViewer.scene.primitives.add(modelEntity);
      } catch (error) {
        console.error("❌ Model load failed:", error);
      }
    }

    if (firstAntennaPosition) {
      flyToFirstAntenna(terria, firstAntennaPosition);
    }
  } catch (error) {
    console.error("❌ Error loading Site GeoJSON:", error);
  }
}

// Load Ticket GeoJSON
async function loadTicketGeoJSON() {
  console.log("📡 Fetching Ticket GeoJSON...");
  try {
    Cesium.Ion.defaultAccessToken = ticketAccessToken;
    window.ticketGeoJsonData = await Cesium.IonResource.fromAssetId(ticketGeoJsonAssetId).then(res => res.fetchJson());
    console.log("✅ Ticket GeoJSON loaded.");
  } catch (error) {
    console.error("❌ Error loading Ticket GeoJSON:", error);
  }
}

// ✅ Unified Fly to Site ID (New + Legacy datasets)
window.flyToSiteID = function (siteID) {
  console.log(`🚀 flyToSiteID triggered for: ${siteID}`);

  let dataset = null;

  // Check new Site ID dataset
  if (window.siteIdGeoJsonData) {
    dataset = window.siteIdGeoJsonData.features.find(
      feature => feature.properties["siteid"]?.toString().toUpperCase() === siteID.toUpperCase()
    );
  }

  // Fallback to legacy dataset
  if (!dataset && window.siteGeoJsonData) {
    dataset = window.siteGeoJsonData.features.find(
      feature => feature.properties["siteid"]?.toString().toUpperCase() === siteID.toUpperCase()
    );
  }

  if (!dataset) {
    console.warn(`⚠️ Site ID ${siteID} not found in any dataset.`);
    return;
  }

  const [longitude, latitude] = dataset.geometry.coordinates;
  flyCameraTo(longitude, latitude);
};

// ✅ Fly to Ticket ID (already working)
window.flyToTicketLocation = function (ticketID) {
  console.log(`🚀 flyToTicketLocation triggered for: ${ticketID}`);

  if (!window.ticketGeoJsonData) {
    console.error("❌ Ticket GeoJSON not loaded.");
    return;
  }

  const ticketFeature = window.ticketGeoJsonData.features.find(
    feature => feature.properties["Ticket ID"]?.toString().toLowerCase() === ticketID.toLowerCase()
  );

  if (!ticketFeature) {
    console.warn(`⚠️ Ticket ID ${ticketID} not found.`);
    return;
  }

  const [longitude, latitude] = ticketFeature.geometry.coordinates;
  flyCameraTo(longitude, latitude);
};

// Universal Fly-to Camera
function flyCameraTo(longitude, latitude) {
  if (!window.terria?.currentViewer?.scene) {
    console.error("❌ Cesium scene not ready.");
    return;
  }

  window.terria.currentViewer.scene.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(longitude, latitude, 1000),
    duration: 2,
    orientation: { heading: 0, pitch: -1.5, roll: 0 }
  });

  console.log("✅ Camera movement triggered!");
}

// Terrain Height Utility
async function getTerrainHeight(longitude, latitude) {
  const scene = window.terria?.currentViewer?.scene;
  if (!scene) return 0;
  const terrainProvider = scene.terrainProvider;
  const positions = [Cesium.Cartographic.fromDegrees(longitude, latitude)];
  try {
    const heights = await Cesium.sampleTerrainMostDetailed(terrainProvider, positions);
    return heights[0]?.height || 0;
  } catch {
    return 0;
  }
}

// Fly to First Antenna Location
function flyToFirstAntenna(terria, position) {
  terria.currentViewer.scene.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(position.longitude, position.latitude, Math.max(position.height + 50, 100)),
    duration: 3,
    orientation: { heading: 0, pitch: -0.5, roll: 0 }
  });
}
