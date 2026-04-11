import React, { useState, useEffect } from "react";
import { X, User, MapPin, Activity, Heart, Ruler, Weight, Save, Check, AlertCircle, Moon } from "lucide-react";
import "./ProfileSidebar.css";

const DOSHAS = [
    { value: "Vata", emoji: "🌬️", label: "Vata" },
    { value: "Pitta", emoji: "🔥", label: "Pitta" },
    { value: "Kapha", emoji: "🌊", label: "Kapha" },
    { value: "Vata-Pitta", emoji: "🌬️🔥", label: "Vata-Pitta" },
    { value: "Pitta-Kapha", emoji: "🔥🌊", label: "Pitta-Kapha" },
    { value: "Vata-Kapha", emoji: "🌬️🌊", label: "Vata-Kapha" },
];

function getBmiCategory(bmi) {
    const val = parseFloat(bmi);
    if (val < 18.5) return { label: "Underweight", className: "underweight" };
    if (val < 25) return { label: "Normal", className: "normal" };
    if (val < 30) return { label: "Overweight", className: "overweight" };
    return { label: "Obese", className: "obese" };
}

export default function ProfileSidebar({ open, onClose, profile, onProfileChange, bmi }) {
    const [saved, setSaved] = useState(false);
    const [errorMsg, setErrorMsg] = useState("");
    const [missingFields, setMissingFields] = useState([]);

    // Clear error highlights when user updates a field
    const update = (field, value) => {
        onProfileChange({ ...profile, [field]: value });
        setSaved(false);
        if (errorMsg) setErrorMsg("");
        setMissingFields((prev) => prev.filter((f) => f !== field));
    };

    // Clear missing fields when sidebar closes
    useEffect(() => {
        if (!open) {
            setMissingFields([]);
            setErrorMsg("");
        }
    }, [open]);

    const getRequiredFields = () => {
        const base = ["name", "age", "gender", "height", "weight", "bodyType", "dosha", "location", "sleepQuality"];
        // Menstrual Cycles is required for Female patients
        if (profile.gender === "Female") {
            base.push("menstrualCycles");
        }
        return base;
    };

    const handleSave = () => {
        // Validate required fields (chronicDisease is optional)
        const requiredFields = getRequiredFields();
        const empty = requiredFields.filter((field) => !profile[field] || profile[field].toString().trim() === "");

        if (empty.length > 0) {
            setMissingFields(empty);
            setErrorMsg("Please fill all required information. Only Chronic History is optional.");
            return;
        }

        setMissingFields([]);
        localStorage.setItem("samsara_profile", JSON.stringify(profile));
        setSaved(true);
        setErrorMsg("");

        // Close sidebar after a short delay to show success state
        setTimeout(() => {
            setSaved(false);
            onClose();
        }, 1200);
    };

    const isFieldMissing = (field) => missingFields.includes(field);

    const bmiInfo = bmi ? getBmiCategory(bmi) : null;

    return (
        <>
            <div
                className={`sidebar-overlay ${open ? "open" : ""}`}
                onClick={onClose}
                aria-hidden="true"
            />

            <aside className={`profile-sidebar ${open ? "open" : ""}`} id="profile-sidebar">
                <div className="sidebar-header">
                    <div className="sidebar-header-left">
                        <div className="sidebar-header-icon">
                            <User size={18} />
                        </div>
                        <h2 className="sidebar-title">Patient Profile</h2>
                    </div>
                    <button
                        className="close-sidebar-btn"
                        onClick={onClose}
                        aria-label="Close profile"
                        id="close-sidebar-btn"
                    >
                        <X size={18} />
                    </button>
                </div>

                <div className="sidebar-body">
                    {/* Personal Info */}
                    <div className="form-section">
                        <span className="form-section-title">Personal Info</span>

                        <div className="form-group">
                            <label className="form-label"><User size={14} /> Name <span className="required-star">*</span></label>
                            <input
                                className={`form-input ${isFieldMissing("name") ? "field-error" : ""}`}
                                value={profile.name}
                                onChange={(e) => update("name", e.target.value)}
                                placeholder="Your name"
                            />
                        </div>

                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label">Age <span className="required-star">*</span></label>
                                <input
                                    className={`form-input ${isFieldMissing("age") ? "field-error" : ""}`}
                                    type="number"
                                    value={profile.age}
                                    onChange={(e) => update("age", e.target.value)}
                                    placeholder="Age"
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Gender <span className="required-star">*</span></label>
                                <select
                                    className={`form-select ${isFieldMissing("gender") ? "field-error" : ""}`}
                                    value={profile.gender}
                                    onChange={(e) => update("gender", e.target.value)}
                                >
                                    <option value="">Select...</option>
                                    <option value="Male">Male</option>
                                    <option value="Female">Female</option>
                                    <option value="Other">Other</option>
                                </select>
                            </div>
                        </div>

                        {/* Menstrual Cycles — shown only for Female */}
                        {profile.gender === "Female" && (
                            <div className="form-group female-field-reveal">
                                <label className="form-label">
                                    <Moon size={14} /> No. of Cycles / Month
                                </label>
                                <input
                                    className={`form-input ${isFieldMissing("menstrualCycles") ? "field-error" : ""}`}
                                    type="number"
                                    min="0"
                                    max="5"
                                    value={profile.menstrualCycles}
                                    onChange={(e) => update("menstrualCycles", e.target.value)}
                                    placeholder="e.g. 1"
                                />
                                <span className="form-hint">Average menstrual cycles per month</span>
                            </div>
                        )}
                    </div>

                    <hr className="sidebar-divider" />

                    {/* Sleep Quality */}
                    <div className="form-section">
                        <span className="form-section-title">Sleep</span>

                        <div className="form-group">
                            <label className="form-label"><Moon size={14} /> Sleep Quality <span className="required-star">*</span></label>
                            <div className="sleep-grid">
                                {[
                                    { value: "Light", emoji: "🌙", desc: "Disturbed / Restless" },
                                    { value: "Moderate", emoji: "😴", desc: "Average / Okay" },
                                    { value: "Deep", emoji: "💤", desc: "Deep / Refreshing" },
                                ].map((s) => (
                                    <button
                                        key={s.value}
                                        type="button"
                                        className={`sleep-card ${profile.sleepQuality === s.value ? "active" : ""} ${isFieldMissing("sleepQuality") ? "field-error" : ""}`}
                                        onClick={() => update("sleepQuality", s.value)}
                                    >
                                        <span className="sleep-emoji">{s.emoji}</span>
                                        <span className="sleep-value">{s.value}</span>
                                        <span className="sleep-desc">{s.desc}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    <hr className="sidebar-divider" />

                    {/* Body Measurements */}
                    <div className="form-section">
                        <span className="form-section-title">Body</span>

                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label"><Ruler size={14} /> Height (cm) <span className="required-star">*</span></label>
                                <input
                                    className={`form-input ${isFieldMissing("height") ? "field-error" : ""}`}
                                    type="number"
                                    value={profile.height}
                                    onChange={(e) => update("height", e.target.value)}
                                    placeholder="175"
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label"><Weight size={14} /> Weight (kg) <span className="required-star">*</span></label>
                                <input
                                    className={`form-input ${isFieldMissing("weight") ? "field-error" : ""}`}
                                    type="number"
                                    value={profile.weight}
                                    onChange={(e) => update("weight", e.target.value)}
                                    placeholder="70"
                                />
                            </div>
                        </div>

                        {bmi && (
                            <div className="bmi-display">
                                <div>
                                    <div className="bmi-label">BMI</div>
                                    {bmiInfo && (
                                        <div className={`bmi-category ${bmiInfo.className}`}>
                                            {bmiInfo.label}
                                        </div>
                                    )}
                                </div>
                                <div className="bmi-value">{bmi}</div>
                            </div>
                        )}

                        <div className="form-group">
                            <label className="form-label">Body Type <span className="required-star">*</span></label>
                            <select
                                className={`form-select ${isFieldMissing("bodyType") ? "field-error" : ""}`}
                                value={profile.bodyType}
                                onChange={(e) => update("bodyType", e.target.value)}
                            >
                                <option value="">Select...</option>
                                <option value="Slim">Slim (Ectomorph)</option>
                                <option value="Medium">Medium (Mesomorph)</option>
                                <option value="Heavy">Heavy (Endomorph)</option>
                            </select>
                        </div>
                    </div>

                    <hr className="sidebar-divider" />

                    {/* Ayurveda */}
                    <div className="form-section">
                        <span className="form-section-title">Ayurveda</span>

                        <div className="form-group">
                            <label className="form-label"><Activity size={14} /> Dosha (Prakriti) <span className="required-star">*</span></label>
                            <div className="dosha-grid">
                                {DOSHAS.map((d) => (
                                    <button
                                        key={d.value}
                                        className={`dosha-card ${profile.dosha === d.value ? "active" : ""} ${isFieldMissing("dosha") ? "field-error" : ""}`}
                                        onClick={() => update("dosha", d.value)}
                                        type="button"
                                    >
                                        <span className="dosha-emoji">{d.emoji}</span>
                                        {d.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    <hr className="sidebar-divider" />

                    {/* Location & History */}
                    <div className="form-section">
                        <span className="form-section-title">Additional</span>

                        <div className="form-group">
                            <label className="form-label"><MapPin size={14} /> Location <span className="required-star">*</span></label>
                            <input
                                className={`form-input ${isFieldMissing("location") ? "field-error" : ""}`}
                                placeholder="City, State"
                                value={profile.location}
                                onChange={(e) => update("location", e.target.value)}
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label"><Heart size={14} /> Chronic History <span className="optional-tag">(Optional)</span></label>
                            <textarea
                                className="form-textarea"
                                rows={3}
                                placeholder="Any long-term health issues..."
                                value={profile.chronicDisease}
                                onChange={(e) => update("chronicDisease", e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Error Message */}
                    {errorMsg && (
                        <div className="validation-error">
                            <AlertCircle size={16} />
                            {errorMsg}
                        </div>
                    )}

                    {/* Save Button */}
                    <button
                        className={`save-profile-btn ${saved ? "saved" : ""}`}
                        onClick={handleSave}
                        id="save-profile-btn"
                    >
                        {saved ? (
                            <><Check size={18} /> Profile Saved!</>
                        ) : (
                            <><Save size={18} /> Save Profile</>
                        )}
                    </button>
                </div>
            </aside>
        </>
    );
}
