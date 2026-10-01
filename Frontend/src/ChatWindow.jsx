import "./ChatWindow.css";
import Chat from "./Chat.jsx";
import { MyContext } from "./MyContext.jsx";
import { useContext, useState, useEffect, useRef } from "react";
import { ScaleLoader } from "react-spinners";

function ChatWindow() {
    const { prompt, setPrompt, reply, setReply, currThreadId, setPrevChats, setNewChat, isSidebarOpen, setIsSidebarOpen } = useContext(MyContext);
    const [loading, setLoading] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const [uploadedFile, setUploadedFile] = useState(null);
    const fileInputRef = useRef(null);

    const getReply = async () => {
        if (!prompt.trim() && !uploadedFile) return;

        setLoading(true);
        setNewChat(false);

        // 1. User ka message screen par update karein
        const displayPrompt = uploadedFile ? `[File: ${uploadedFile.name}] ${prompt}` : prompt;
        setPrevChats(prev => [...prev, { role: "user", content: displayPrompt }]);

        // 2. Form Data banayein files aur multipart requests ke liye
        const formData = new FormData();
        formData.append("message", prompt);
        formData.append("threadId", currThreadId);
        if (uploadedFile) {
            formData.append("file", uploadedFile);
        }

        setPrompt(""); 
        setUploadedFile(null); // Uploaded cache clear karein

        try {
            const response = await fetch("http://localhost:8080/api/chat", {
                method: "POST",
                body: formData 
            });
            const res = await response.json();
            
            // Safe assignment: Agar backend crash bhi ho, toh screen blank na ho
            if (res && res.reply) {
                setReply(res.reply);
            } else {
                setReply("System Notice: Response layout mismatch occurred during transmission.");
            }
        } catch(err) {
            console.log(err);
            setReply("AeroGPT Network Alert: Failed to connect or read the dynamic vector stream from server.");
        } finally {
            setLoading(false); // Loading state ko hamesha band karne ke liye
        }
    }; // <--- YAHAN PAR CLOSING BRACE MISSING THA, AB FIX HO GAYA HAI!
    
    const handleFileChange = (e) => {
        if (e.target.files.length > 0) {
            setUploadedFile(e.target.files[0]);
        }
    };

    const triggerFileSelect = () => {
        fileInputRef.current.click();
    };

    useEffect(() => {
        if (reply) {
            setPrevChats(prevChats => [...prevChats, { role: "assistant", content: reply }]);
            setReply(null); 
        }
    }, [reply, setPrevChats, setReply]);

    const handleProfileClick = () => {
        setIsOpen(!isOpen);
    };

    return (
        <div className={`chatWindow ${isSidebarOpen ? "" : "fullWidth"}`}>
            <div className="navbar">
                <div className="left-nav-wrapper">
                    <button className="toggle-sidebar-btn" onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
                        <i className="fa-solid fa-bars"></i>
                    </button>
                    <span>AeroGPT <i className="fa-solid fa-chevron-down"></i></span>
                </div>
                
                <div className="userIconDiv" onClick={handleProfileClick}>
                    <span className="userIcon"><i className="fa-solid fa-user"></i></span>
                </div>
            </div>
            
            {isOpen && (
                <div className="dropDown">
                    <div className="dropDownItem"><i className="fa-solid fa-gear"></i> Settings</div>
                    <div className="dropDownItem"><i className="fa-solid fa-cloud-arrow-up"></i> Upgrade plan</div>
                    <div className="dropDownItem"><i className="fa-solid fa-arrow-right-from-bracket"></i> Log out</div>
                </div>
            )}
            
            <Chat />

            {loading && (
                <div className="loader-container">
                    <ScaleLoader color="#fff" height={25} width={3} radius={2} margin={2} />
                </div>
            )}
            
            <div className="chatInput">
                <div className="inputBox">
                    {/* Hidden Native File Input */}
                    <input 
                        type="file" 
                        ref={fileInputRef} 
                        onChange={handleFileChange} 
                        style={{ display: 'none' }}
                        accept=".txt,.pdf,.md,.csv"
                    />
                    
                    {/* Attach File Button inside Search Bar */}
                    <button className="attach-btn" onClick={triggerFileSelect}>
                        <i className="fa-solid fa-paperclip"></i>
                    </button>

                    <input 
                        placeholder={uploadedFile ? `File attached: ${uploadedFile.name}` : "Ask anything or upload a document..."}
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' ? getReply() : ''}
                    />
                    <div id="submit" onClick={getReply}>
                        <i className="fa-solid fa-paper-plane"></i>
                    </div>
                </div>
                <p className="info">
                    Smart RAG Mode Active. Large corporate document chunking enabled up to 50MB.
                </p>
            </div>
        </div>
    );
}

export default ChatWindow;