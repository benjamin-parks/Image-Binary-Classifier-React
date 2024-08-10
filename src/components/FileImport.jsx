import React from 'react';

export default function FileImport({ file, buttonText, onFileSelect }) {
    const handleFileChange = (e) => {
        const selectedFile = e.target.files[0];
        if (onFileSelect) {
            onFileSelect(selectedFile);
        }
    };

    return (
        <div style={{ display: "inline" }}>
            {file ? (
                <>
                    <input
                        className="form-control"
                        type="file"
                        id="imageLoader"
                        name="imageLoader"
                        style={{ display: 'none' }}
                        onChange={handleFileChange} // Handle single file selection
                    />
                    <label
                        htmlFor="imageLoader"
                        className="btn btn-primary"
                    >
                        {buttonText || "Select File to Annotate"}
                    </label>
                </>
            ) : (
                <>
                    <input
                        className="form-control"
                        type="file"
                        id="directoryLoader"
                        name="directoryLoader"
                        webkitdirectory="true"
                        directory="true"
                        style={{ display: 'none' }}
                    />
                    <label
                        htmlFor="directoryLoader"
                        className="btn btn-primary"
                    >
                        {buttonText || "Select Directory For Inference"}
                    </label>
                </>
            )}
        </div>
    );
}
