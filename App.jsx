import React, { useState, useCallback } from "react";
import { Camera, Image, Wand2, Download } from "lucide-react";

const API_KEY = "AIzaSyAPWYQA-BQmFrPRgdrXxs-_Xqv8kkGJnIE";
const MODEL_NAME = "gemini-2.5-flash-image-preview";
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${API_KEY}`;
const MAX_RETRIES = 5;

const fileToBase64 = (file) => new Promise((resolve, reject) => {
  if (!file) return reject("No file");
  const reader = new FileReader();
  reader.onload = () => resolve({ base64: reader.result.split(",")[1], mimeType: file.type });
  reader.onerror = (err) => reject(err);
  reader.readAsDataURL(file);
});

const fetchWithBackoff = async (url, options, retries = 0) => {
  try {
    const response = await fetch(url, options);
    if (response.status === 429 && retries < MAX_RETRIES) {
      const delay = Math.pow(2, retries) * 1000 + Math.random() * 1000;
      await new Promise(r => setTimeout(r, delay));
      return fetchWithBackoff(url, options, retries + 1);
    }
    if (!response.ok) throw new Error(await response.text());
    return response;
  } catch (err) {
    if (retries < MAX_RETRIES) {
      const delay = Math.pow(2, retries) * 1000 + Math.random() * 1000;
      await new Promise(r => setTimeout(r, delay));
      return fetchWithBackoff(url, options, retries + 1);
    }
    throw err;
  }
};

const ImageUploadCard = ({ title, icon: Icon, onImageChange, imagePreview, type }) => {
  const isAdult = type === "adult";
  return (
    <div className="bg-white p-6 shadow-xl rounded-2xl w-full max-w-sm border border-indigo-100">
      <h3 className="text-xl font-semibold mb-3 text-gray-800 flex items-center">
        <Icon className="w-5 h-5 mr-2 text-indigo-500" />
        {title}
      </h3>
      <label className="block w-full h-48 border-4 border-dashed border-indigo-300 rounded-xl cursor-pointer bg-indigo-50 hover:bg-indigo-100 relative overflow-hidden">
        {imagePreview ? (
          <img src={imagePreview} className="w-full h-full object-cover" />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-indigo-500 p-4 text-center">
            <Camera className="w-8 h-8 mb-2" />
            <span className="font-medium">Click to upload {isAdult ? "Recent Photo" : "Child Photo"}</span>
          </div>
        )}
        <input type="file" className="hidden" accept="image/jpeg,image/png" onChange={onImageChange} />
      </label>
    </div>
  );
};

const App = () => {
  const [childImage, setChildImage] = useState({});
  const [adultImage, setAdultImage] = useState({});
  const [outputImage, setOutputImage] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleImageChange = useCallback(async (event, setImageState) => {
    setErrorMessage("");
    const file = event.target.files[0];
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) return setErrorMessage("Image exceeds 4MB");
    try {
      const { base64, mimeType } = await fileToBase64(file);
      setImageState({ base64, mimeType, preview: URL.createObjectURL(file) });
    } catch {
      setErrorMessage("Could not process image");
    }
  }, []);

  const generateImage = async () => {
    if (!childImage.base64 || !adultImage.base64) return setErrorMessage("Upload both photos first.");
    setIsLoading(true);
    setErrorMessage("");

    const payload = {
      contents: [
        {
          parts: [
            { text: "Generate emotional portrait with adult holding hands with child version." },
            { inlineData: { mimeType: childImage.mimeType, data: childImage.base64 } },
            { inlineData: { mimeType: adultImage.mimeType, data: adultImage.base64 } }
          ]
        }
      ],
      generationConfig: {
        responseModalities: ["TEXT","IMAGE"],
        aspectRatio: "3:4",
        numberOfImages: 1
      }
    };

    try {
      const res = await fetchWithBackoff(API_URL, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(payload) });
      const json = await res.json();
      const data = json?.candidates?.[0]?.content?.parts?.find(p=>p.inlineData)?.inlineData?.data;
      if(data) setOutputImage(`data:image/png;base64,${data}`);
      else setErrorMessage("Model couldn't generate an image.");
    } catch(err) { setErrorMessage(err.message); }
    setIsLoading(false);
  };

  const handleDownload = () => {
    if (!outputImage) return;
    const link = document.createElement("a");
    link.href = outputImage;
    link.download = "Burger_AI_Portrait.png";
    link.click();
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <header className="text-center mb-10">
        <h1 className="text-4xl font-extrabold text-indigo-700 flex justify-center">
          <Wand2 className="w-8 h-8 mr-2" />
          Burger AI: Memory Weaver
        </h1>
        <p className="text-gray-500 text-lg">
          Upload child + adult photo → Burger AI will create an emotional portrait.
        </p>
      </header>

      <div className="flex flex-col lg:flex-row gap-8 justify-center mb-8">
        <ImageUploadCard title="1. Child Photo" icon={Image} type="child" imagePreview={childImage.preview} onImageChange={(e)=>handleImageChange(e,setChildImage)} />
        <ImageUploadCard title="2. Adult Photo" icon={Image} type="adult" imagePreview={adultImage.preview} onImageChange={(e)=>handleImageChange(e,setAdultImage)} />
      </div>

      <div className="flex justify-center mb-8">
        <button onClick={generateImage} className="px-10 py-4 text-xl font-bold rounded-full shadow-lg bg-indigo-600 text-white hover:bg-indigo-700" disabled={isLoading}>
          {isLoading ? "Generating..." : "Generate Portrait"}
        </button>
      </div>

      {errorMessage && <div className="text-center text-red-600">{errorMessage}</div>}

      <div className="bg-white p-6 shadow-xl rounded-2xl border border-gray-200">
        <h2 className="text-2xl font-semibold mb-4 text-center">Generated Portrait</h2>
        <div className="flex justify-center min-h-64">
          {outputImage ? (
            <div className="relative">
              <img src={outputImage} className="rounded-xl shadow-xl max-w-md" />
              <button onClick={handleDownload} className="absolute bottom-4 right-4 p-3 bg-indigo-500 text-white rounded-full shadow-lg">
                <Download className="w-6 h-6" />
              </button>
            </div>
          ) : <div className="text-gray-500 text-center">Your final portrait will appear here.</div>}
        </div>
      </div>
    </div>
  );
};

export default App;
