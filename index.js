"use strict";

console.log("✅ index.js has loaded successfully!");

var terriaOptions = {
  baseUrl: "build/TerriaJS"
};

import { runInAction } from "mobx";
import ConsoleAnalytics from "terriajs/lib/Core/ConsoleAnalytics";
import GoogleAnalytics from "terriajs/lib/Core/GoogleAnalytics";
import ShareDataService from "terriajs/lib/Models/ShareDataService";
// import registerAnalytics from 'terriajs/lib/Models/registerAnalytics';
import registerCustomComponentTypes from "terriajs/lib/ReactViews/Custom/registerCustomComponentTypes";
import Terria from "terriajs/lib/Models/Terria";
import updateApplicationOnHashChange from "terriajs/lib/ViewModels/updateApplicationOnHashChange";
import updateApplicationOnMessageFromParentWindow from "terriajs/lib/ViewModels/updateApplicationOnMessageFromParentWindow";
import ViewState from "terriajs/lib/ReactViewModels/ViewState";
import render from "./lib/Views/render";
import registerCatalogMembers from "terriajs/lib/Models/Catalog/registerCatalogMembers";
import registerSearchProviders from "terriajs/lib/Models/SearchProviders/registerSearchProviders";
import defined from "terriajs-cesium/Source/Core/defined";
import loadPlugins from "./lib/Core/loadPlugins";
import plugins from "./plugins";

// Register all types of catalog members in the core TerriaJS.
registerCatalogMembers();

// we check exact match for development to reduce chances that production flag isn't set on builds(?)
if (process.env.NODE_ENV === "development") {
  terriaOptions.analytics = new ConsoleAnalytics();
} else {
  terriaOptions.analytics = new GoogleAnalytics();
}

// Construct the TerriaJS application, arrange to show errors to the user, and start it up.
var terria = new Terria(terriaOptions);

// Register custom components in the core TerriaJS.
registerCustomComponentTypes(terria);

// Create the ViewState before terria.start
const viewState = new ViewState({
  terria: terria
});

registerSearchProviders();

if (process.env.NODE_ENV === "development") {
  window.viewState = viewState;
}

// If we're running in dev mode, disable the built style sheet.
if (process.env.NODE_ENV !== "production" && module.hot) {
  document.styleSheets[0].disabled = true;
}

// Function to add a message to the chatbox
function addMessage(message, sender) {
  const chatBody = document.querySelector(".chatbox-body");
  const messageElement = document.createElement("p");
  messageElement.className = sender; // "user" or "bot"
  messageElement.textContent = message;
  chatBody.appendChild(messageElement);
  chatBody.scrollTop = chatBody.scrollHeight; // Scroll to the bottom
}

// Function to send a message to Rasa
function sendMessageToRasa(messageData) {
  console.log("🔄 Preparing to send message to Rasa:", messageData);
  fetch(
    "http://localhost:5005/webhooks/rest/webhook",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(messageData)
    }
  )
    .then((response) => {
      console.log("✅ Rasa responded:", response);
      return response.json();
    })
    .then((data) => {
      console.log("📩 Rasa Response Data:", data);
      if (data && data.length > 0) {
        data.forEach((response) => {
          addMessage(response.text, "bot");
        });
      }
    })
    .catch((error) => {
      console.error("❌ Error sending message to Rasa:", error);
      addMessage("Sorry, an error occurred. Please try again.", "bot");
    });
}

// Setup event listeners (this is the core of the fix and will be explained below)
function setupChatEventListeners() {
  const chatboxModal = document.getElementById("chatboxModal");
  const chatInput = document.getElementById("chatInput");
  const sendButton = document.getElementById("sendButton");
  const floatingButton = document.getElementById("floatingButton");
  const chatboxButtons = document.querySelector(".chatbox-buttons");
  if (
    !floatingButton ||
    !chatboxModal ||
    !sendButton ||
    !chatInput ||
    !chatboxButtons
  ) {
    console.error("❌ Chatbot elements are missing from the DOM!");
    return;
  }

  // Toggle chatbox visibility
  floatingButton.addEventListener("click", () => {
    console.log("✅ Floating button clicked!");
    chatboxModal.classList.toggle("show");
  });

  // Handle button clicks for predefined intents
  chatboxButtons.addEventListener("click", (event) => {
    const button = event.target;
    if (button.tagName === "BUTTON") {
      const intent = button.dataset.intent;
      if (intent) {
        const messageData = {
          sender: "user",
          message: button.textContent,
          metadata: { intent: intent }
        };
        addMessage(button.textContent, "user");
        sendMessageToRasa(messageData);
      }
    }
  });

  // Handle sending message via input box - CORRECTED LOGIC
  sendButton.addEventListener("click", () => {
    const userMessage = chatInput.value.trim();
    if (userMessage) {
      addMessage(userMessage, "user");
      sendMessageToRasa({ sender: "user", message: userMessage });
      chatInput.value = ""; // Clear input after sending
    }
  });

  // Handle Enter key press in input field
  chatInput.addEventListener("keypress", (event) => {
    if (event.key === "Enter") {
      event.preventDefault(); // Prevent default behavior (form submission, new line)
      sendButton.click(); // Trigger the send button's click event
    }
  });
}

terria
  .start({
    applicationUrl: window.location,
    configUrl: "config.json",
    shareDataService: new ShareDataService({
      terria: terria
    }),
    beforeRestoreAppState: () => {
      // Load plugins before restoring app state.
      return loadPlugins(viewState, plugins).catch((error) => {
        console.error(`Error loading plugins`);
        console.error(error);
      });
    }
  })
  .then(() => {
    // Chain loadInitSources *here*
    return terria.loadInitSources();
  })
  .then(() => {
    console.log("✅ Terria data sources initialized:", terria.dataSources);
    console.log("Workbench Items:", terria.workbench.items);
    const osmBuildings = terria.workbench.items.find(
      (item) => item.name === "Cesium OSM Buildings"
    );
    if (osmBuildings) {
      console.log("✅ Cesium OSM Buildings loaded successfully!");
    } else {
      console.error("❌ Cesium OSM Buildings failed to load.");
      console.log("Current workbench items:", terria.workbench.items);
      console.log("Workbench Items After Load:", terria.workbench.items);
    }
  })
  .catch(function (e) {
    console.error("❌ Error during Terria startup:", e); // More detailed error
    terria.raiseErrorToUser(e);
  })
  .finally(function () {
    // ... rest of your finally block ...
    // Override the default document title with appName.
    if (document.title === "Terria Map") {
      document.title = terria.appName;
    }
    // Expose the Terria instance and ViewState globally
    window.terria = terria;
    console.log("Debugging Terria instance:", window.terria);
    window.viewState = viewState;
    console.log("✅ Terria instance and ViewState exposed globally.");

    try {
      // Automatically update Terria (load new catalogs, etc.) when the hash part of the URL changes.
      updateApplicationOnHashChange(terria, window);
      updateApplicationOnMessageFromParentWindow(terria, window);

      // Show a modal disclaimer before user can do anything else.
      if (defined(terria.configParameters.globalDisclaimer)) {
        var globalDisclaimer = terria.configParameters.globalDisclaimer;
        var hostname = window.location.hostname;
        if (
          (defined(globalDisclaimer.devHostRegex) &&
            hostname.match(globalDisclaimer.devHostRegex)) ||
          (defined(globalDisclaimer.prodHostRegex) &&
            !hostname.match(globalDisclaimer.prodHostRegex))
        ) {
          var message = "";
          message += require("./lib/Views/DevelopmentDisclaimerPreamble.html");
          message += require("./lib/Views/GlobalDisclaimer.html");

          var options = {
            title:
              globalDisclaimer.title !== undefined
                ? globalDisclaimer.title
                : "Warning",
            confirmText: globalDisclaimer.buttonTitle || "Ok",
            denyText: globalDisclaimer.denyText || "Cancel",
            denyAction: globalDisclaimer.afterDenyLocation
              ? function () {
                  window.location = globalDisclaimer.afterDenyLocation;
                }
              : undefined,
            width: 600,
            height: 550,
            message: message,
            horizontalPadding: 100
          };
          runInAction(() => {
            viewState.disclaimerSettings = options;
            viewState.disclaimerVisible = true;
          });
        }
      }

      // Add font-imports
      const fontImports = terria.configParameters.theme?.fontImports;
      if (fontImports) {
        const styleSheet = document.createElement("style");
        styleSheet.type = "text/css";
        styleSheet.innerText = fontImports;
        document.head.appendChild(styleSheet);
      }

      render(terria, [], viewState);
    } catch (e) {
      console.error(e);
      console.error(e.stack);
    }
    setupChatEventListeners();
  });
