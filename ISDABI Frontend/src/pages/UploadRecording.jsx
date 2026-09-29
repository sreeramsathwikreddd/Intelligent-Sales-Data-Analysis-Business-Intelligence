import { useState } from 'react';
import { calls as callsApi } from '../services/api';
import PageHeader from '../components/PageHeader';
import Icon from '../components/Icon';
import { useToast } from '../components/Toast';
import { friendlyError } from '../utils/errors';
import '../styles/UploadRecording.css';

export default function UploadRecording() {
  const toast = useToast();

  const [file, setFile] = useState(null);
  const [uploaded, setUploaded] = useState(null);
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);

  const submit = async (event) => {
    event.preventDefault();

    if (!file) {
      setError({
        message: 'Please select an audio recording.'
      });
      return;
    }

    setUploading(true);
    setProgress(0);
    setError(null);

    try {
      const response =
        await callsApi.upload(
          file,
          (eventProgress) => {
            if (eventProgress.total) {
              setProgress(
                Math.round(
                  (eventProgress.loaded /
                    eventProgress.total) *
                    100
                )
              );
            }
          }
        );

      const call =
        response?.data?.data || null;

      setProgress(100);
      setUploaded(call);
      setFile(null);

      toast.success(
        'Recording uploaded successfully. Analysis has not started.'
      );
    } catch (err) {
      setError(err);
    } finally {
      setUploading(false);
    }
  };

  const clearSelection = () => {
    if (uploading) return;

    setFile(null);
    setProgress(0);
    setError(null);
  };

  return (
    <>
      <PageHeader
        title="Upload Recordings"
        subtitle="Upload a sales recording now. Analysis starts later from Role Based Reports."
      />

      <div className="upload-page">

        {/* MAIN UPLOAD CARD */}
        <section className="upload-card">

          <div className="upload-card-header">
            <div>
              <span className="upload-eyebrow">
                SALES REPRESENTATIVE
              </span>

              <h2>
                Upload a sales call
              </h2>

              <p>
                Save the recording securely.
                Analysis will not start automatically.
              </p>
            </div>

            <div
              className="upload-header-icon"
              aria-hidden="true"
            >
              <Icon name="upload" />
            </div>
          </div>

          <form
            onSubmit={submit}
            className="upload-form"
          >

            {/* FILE SELECTOR */}
            <label
              className={
                "upload-file-box" +
                (file ? " has-file" : "")
              }
            >
              <input
                type="file"
                accept="audio/*"
                disabled={uploading}
                onChange={(event) => {
                  setFile(
                    event.target.files?.[0] ||
                      null
                  );
                  setError(null);
                }}
              />

              <span
                className="upload-file-icon"
                aria-hidden="true"
              >
                <Icon name="upload" />
              </span>

              <span className="upload-file-content">
                <strong>
                  {file
                    ? file.name
                    : 'Choose an audio recording'}
                </strong>

                <span>
                  {file
                    ? 'Ready to upload'
                    : 'MP3, WAV, M4A, FLAC, OGG or WEBM'}
                </span>
              </span>

              <span className="upload-browse-button">
                Browse
              </span>
            </label>

            {/* PROGRESS */}
            {uploading && (
              <div className="upload-progress-area">

                <div className="upload-progress-top">
                  <span>
                    Uploading recording
                  </span>

                  <strong>
                    {progress}%
                  </strong>
                </div>

                <div className="upload-progress-track">
                  <span
                    style={{
                      width: `${progress}%`
                    }}
                  />
                </div>

              </div>
            )}

            {/* SUCCESS */}
            {uploaded && (
              <div className="upload-success">

                <div className="upload-success-icon">
                  <span>✓</span>
                </div>

                <div className="upload-success-content">
                  <strong>
                    Recording uploaded successfully
                  </strong>

                  <span>
                    {uploaded.originalFilename ||
                      'Audio recording'}
                  </span>
                </div>

                <span className="upload-status">
                  Uploaded
                </span>

              </div>
            )}

            {/* ERROR */}
            {error && (
              <div className="upload-error">
                <span className="upload-error-icon">
                  !
                </span>

                <span>
                  {friendlyError(
                    error,
                    'Unable to upload the recording.'
                  )}
                </span>
              </div>
            )}

            {/* ACTIONS */}
            <div className="upload-actions">

              <button
                className="upload-primary-button"
                type="submit"
                disabled={
                  uploading || !file
                }
              >
                <Icon name="upload" />

                <span>
                  {uploading
                    ? 'Uploading...'
                    : 'Upload Recording'}
                </span>
              </button>

              <button
                className="upload-secondary-button"
                type="button"
                disabled={uploading}
                onClick={clearSelection}
              >
                Clear
              </button>

            </div>

          </form>
        </section>

        {/* INFORMATION CARDS */}
        <section className="upload-info-grid">

          <article className="upload-info-card">

            <div className="upload-info-icon">
              <span>01</span>
            </div>

            <div>
              <h3>
                Upload only
              </h3>

              <p>
                The recording is saved to your
                account with status
                <strong> Uploaded</strong>.
              </p>
            </div>

          </article>

          <article className="upload-info-card">

            <div className="upload-info-icon">
              <span>02</span>
            </div>

            <div>
              <h3>
                Analyze later
              </h3>

              <p>
                Analysts and the Head Analyst
                can start analysis from Role
                Based Reports.
              </p>
            </div>

          </article>

        </section>

      </div>
    </>
  );
}