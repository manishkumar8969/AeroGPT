import "./Chat.css";
import React, { useContext, useState, useEffect } from "react";
import { MyContext } from "./MyContext";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import "highlight.js/styles/github-dark.css";

function Chat() {
    const { newChat, prevChats, reply } = useContext(MyContext);
    const [latestReply, setLatestReply] = useState(null);

    useEffect(() => {
        if (reply === null) {
            setLatestReply(null); 
            return;
        }

        if (!prevChats?.length) return;

        // Content safe check string validation
        const targetText = String(reply || "");
        const content = targetText.split(" "); 

        let idx = 0;
        const interval = setInterval(() => {
            setLatestReply(content.slice(0, idx + 1).join(" "));
            idx++;
            if (idx >= content.length) clearInterval(interval);
        }, 30);

        return () => clearInterval(interval);
    }, [prevChats, reply]);

    // String logic parsing verification
    const safeRenderContent = (content) => {
        return typeof content === 'string' ? content : JSON.stringify(content);
    };

    return (
        <>
            {newChat && (
                <div className="welcome-container">
                    <h1>Start a New Chat!</h1>
                </div>
            )}
            
            <div className="chats">
                {prevChats && prevChats.slice(0, -1).map((chat, idx) => (
                    <div className={chat && chat.role === "user" ? "userDiv" : "gptDiv"} key={idx}>
                        {chat && chat.role === "user" ? (
                            <p className="userMessage">{safeRenderContent(chat.content)}</p>
                        ) : (
                            <ReactMarkdown rehypePlugins={[rehypeHighlight]}>
                                {safeRenderContent(chat ? chat.content : "")}
                            </ReactMarkdown>
                        )}
                    </div>
                ))}

                {prevChats && prevChats.length > 0 && (
                    <div className={prevChats[prevChats.length - 1].role === "user" ? "userDiv" : "gptDiv"}>
                        {prevChats[prevChats.length - 1].role === "user" ? (
                            <p className="userMessage">{safeRenderContent(prevChats[prevChats.length - 1].content)}</p>
                        ) : (
                            <ReactMarkdown rehypePlugins={[rehypeHighlight]}>
                                {latestReply === null ? safeRenderContent(prevChats[prevChats.length - 1].content) : safeRenderContent(latestReply)}
                            </ReactMarkdown>
                        )}
                    </div>
                )}
            </div>
        </>
    );
}

export default Chat;