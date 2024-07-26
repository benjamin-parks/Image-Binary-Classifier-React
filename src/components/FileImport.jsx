export default function FileImport({ file, buttonText }) {
    return (
      <div style={{display:"inline"}}>
        {file ? (
          <>
            <input
              className="form-control"
              type="file"
              id="imageLoader"
              name="imageLoader"
              style={{ display: 'none' }}
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
              style={{ display: 'none' }}
            />
            <label style={{paddingLeft:"35%"}}
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