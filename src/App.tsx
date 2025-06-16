import "./App.css";
import React from "react";
import Scene from "./scene/Scene";
import Draw from "./draw/draw";
import DwinzoMain from "./dwinzoMain/dwinzoMain";
import LandingScene from "./Mainscene/landingScene";

const App: React.FC = () => {
  return (
    <div
      className="canvas-section"
      style={{ position: "relative", width: "100vw", height: "100vh" }}
    >

      <LandingScene />
      {/* <DwinzoMain /> */}

      {/* <Draw /> */}
      {/* <Scene /> */}

    </div>
  );
};

export default App;
