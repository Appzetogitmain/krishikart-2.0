import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  User,
  ArrowRight,
  ShieldCheck,
  Cpu,
  Zap,
  Home,
  Command,
  Smartphone,
  MapPin,
  Building2,
  Mail,
  Lock,
  Eye,
  EyeOff,
  ChevronRight,
  Loader2,
  Pencil,
} from "lucide-react";
import { useFranchiseAuth } from "../contexts/FranchiseAuthContext";
import api from "../../../lib/axios";
import {
  FSSAI_REGEX,
  GSTIN_REGEX,
  normalizeFssaiInput,
  isValidFssai,
  normalizeGstInput,
  isValidGst,
} from "../utils/gstin";
import LocationPickerModal from "../components/LocationPickerModal";
import LocationSummary from "../components/LocationSummary";

export default function SignupScreen() {
  const navigate = useNavigate();
  const { loginSuccess } = useFranchiseAuth();

  // Form States
  const [formData, setFormData] = useState({
    franchiseName: "",
    ownerName: "",
    mobile: "",
    email: "",
    password: "",
    area: "",
    city: "",
    state: "",
    servedCategories: [],
    location: null,
    formattedAddress: null,
    fssaiNumber: "",
    gstNumber: "",
  });

  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [categories, setCategories] = useState([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    const fetchCategories = async () => {
      setIsLoadingCategories(true);
      try {
        const response = await api.get("/catalog/categories");
        if (response.data.success) {
          setCategories(response.data.results || []);
        }
      } catch (error) {
        console.error("Failed to fetch categories:", error);
      } finally {
        setIsLoadingCategories(false);
      }
    };
    fetchCategories();
  }, []);

  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState("details"); // 'details' or 'otp'
  const [timer, setTimer] = useState(120);
  const otpRefs = [useRef(), useRef(), useRef(), useRef(), useRef(), useRef()];

  useEffect(() => {
    let interval;
    if (mode === "otp" && timer > 0) {
      interval = setInterval(() => {
        setTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [mode, timer]);

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  const handleResendOtp = async () => {
    if (timer > 0) return;
    setIsLoading(true);
    try {
      await api.post("/franchise/send-otp", { mobile: formData.mobile });
      setTimer(120);
      setOtp(["", "", "", "", "", ""]);
    } catch (error) {
      console.error(error);
      alert(error.response?.data?.message || "Failed to resend OTP");
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (field, value) => {
    if (["ownerName", "city", "state"].includes(field)) {
      value = value.replace(/[^A-Za-z\s]/g, "");
    }
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleLocationConfirm = (locationData) => {
    setFormData((prev) => ({
      ...prev,
      location: locationData.coordinates,
      formattedAddress: locationData.formattedAddress,
      city: locationData.addressComponents.city || prev.city,
      area: locationData.addressComponents.area || prev.area,
      state: locationData.addressComponents.state || prev.state,
    }));
    setIsLocationModalOpen(false);
  };

  const handleNext = async (e) => {
    e.preventDefault();
    if (
      formData.mobile.length === 10 &&
      formData.franchiseName &&
      formData.ownerName &&
      formData.location
    ) {
      if (!formData.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
        alert("Please enter a valid email address");
        return;
      }
      if (!formData.password || formData.password.length < 6) {
        alert("Password must be at least 6 characters");
        return;
      }
      // FSSAI/GST optional — validate only if filled
      if (formData.fssaiNumber && !isValidFssai(formData.fssaiNumber)) {
        alert("Please enter a valid 14-digit FSSAI number");
        return;
      }
      if (formData.gstNumber && !isValidGst(formData.gstNumber)) {
        alert("Please enter a valid 15-digit GSTIN (e.g. 22AAAAA0000A1Z5)");
        return;
      }
      setIsLoading(true);
      try {
        await api.post("/franchise/register", {
          franchiseName: formData.franchiseName,
          ownerName: formData.ownerName,
          mobile: formData.mobile,
          email: formData.email,
          password: formData.password,
          area: formData.area,
          city: formData.city,
          state: formData.state,
          servedCategories: formData.servedCategories,
          location: formData.location,
          formattedAddress: formData.formattedAddress,
          fssaiNumber: normalizeFssaiInput(formData.fssaiNumber),
          gstNumber: normalizeGstInput(formData.gstNumber),
        });
        setMode("otp");
        setTimer(120);
      } catch (error) {
        console.error(error);
        alert(error.response?.data?.message || "Registration failed");
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleOtpChange = (index, value) => {
    if (value.length > 1) value = value[0];
    if (!/^\d*$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    if (value && index < 5) {
      otpRefs[index + 1].current.focus();
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      otpRefs[index - 1].current.focus();
    }
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    const otpValue = otp.join("");
    if (otpValue.length !== 6) return;

    setIsLoading(true);

    try {
      const response = await api.post("/franchise/verify-otp", {
        mobile: formData.mobile,
        otp: otpValue,
      });

      const { token, ...franchiseData } = response.data.result;
      // Persist JWT immediately so refresh can restore session reliably
      if (token) {
        localStorage.setItem("franchiseToken", token);
        localStorage.setItem("franchiseData", JSON.stringify(franchiseData));
      }
      loginSuccess(franchiseData, token);
      navigate(
        franchiseData.isVerified ? "/franchise/dashboard" : "/franchise/documentation",
      );
    } catch (error) {
      console.error(error);
      alert(error.response?.data?.message || "Verification failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col md:flex-row relative overflow-hidden font-sans">
      {/* Left Panel: Information Deck */}
      <div className="hidden md:flex flex-1 flex-col justify-between p-12 relative z-10 border-r border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white rounded-sm flex items-center justify-center text-slate-900 shadow-xl">
            <Home size={24} />
          </div>
          <div className="flex flex-col">
            <span className="text-white text-lg font-black tracking-tight leading-none uppercase">
              Kisaankart
            </span>
            <span className="text-[10px] text-slate-500 font-bold tracking-[0.3em] uppercase">
              Franchise
            </span>
          </div>
        </div>

        <div className="space-y-6 max-w-md">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-black uppercase tracking-widest rounded-sm">
            <Zap size={10} /> Franchise Registration
          </div>
          <h1 className="text-5xl font-black text-white tracking-tighter leading-[0.9] uppercase">
            Become a <br />
            Franchise <br />
            Partner.
          </h1>
          <p className="text-slate-400 text-sm font-medium leading-relaxed uppercase tracking-tight">
            Join our network and start managing orders in your area. Quick
            verification to get you started.
          </p>
        </div>

        <div className="flex items-center gap-12 text-slate-500">
          <div className="flex flex-col">
            <span className="text-xs font-black text-white uppercase tabular-nums tracking-widest">
              Trusted
            </span>
            <span className="text-[10px] font-bold uppercase tracking-widest mt-1">
              Platform
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-black text-white uppercase tabular-nums tracking-widest">
              Secure
            </span>
            <span className="text-[10px] font-bold uppercase tracking-widest mt-1">
              Onboarding
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-black text-white uppercase tabular-nums tracking-widest">
              24/7
            </span>
            <span className="text-[10px] font-bold uppercase tracking-widest mt-1">
              Support
            </span>
          </div>
        </div>

        <div
          className="absolute inset-0 opacity-10 -z-10"
          style={{
            backgroundImage: "radial-gradient(#fff 0.5px, transparent 0.5px)",
            backgroundSize: "24px 24px",
          }}
        />
      </div>

      {/* Right Panel: Registration Form */}
      <div className="flex-1 flex items-center justify-center p-6 bg-slate-900 md:bg-white relative">
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md space-y-12">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-4">
              <Home size={12} />
              <ChevronRight size={10} />
              <span className="text-slate-900 border-b border-slate-900 pb-px">
                Registration
              </span>
            </div>
            <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter leading-none">
              Franchise Details
            </h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">
              Enter your business information
            </p>
          </div>

          <form
            onSubmit={mode === "details" ? handleNext : handleSignup}
            className="space-y-6">
            <AnimatePresence mode="wait">
              {mode === "details" ? (
                <motion.div
                  key="details-input"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] px-1">
                        Shop Name <span className="text-red-500">*</span>
                      </label>
                      <div className="relative group">
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-slate-900 transition-colors">
                          <Building2 size={16} />
                        </div>
                        <input
                          autoFocus
                          value={formData.franchiseName}
                          onChange={(e) =>
                            handleChange("franchiseName", e.target.value)
                          }
                          placeholder="Franchise Name"
                          className="w-full h-12 pl-12 pr-4 bg-slate-50 border border-slate-200 rounded-sm outline-none text-xs font-black text-slate-900 placeholder:text-slate-300 focus:bg-white focus:border-slate-900 transition-all font-sans"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] px-1">
                        Owner Name <span className="text-red-500">*</span>
                      </label>
                      <div className="relative group">
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-slate-900 transition-colors">
                          <User size={16} />
                        </div>
                        <input
                          value={formData.ownerName}
                          onChange={(e) =>
                            handleChange(
                              "ownerName",
                              e.target.value.replace(/[^a-zA-Z\s]/g, ""),
                            )
                          }
                          placeholder="Owner Name"
                          className="w-full h-12 pl-12 pr-4 bg-slate-50 border border-slate-200 rounded-sm outline-none text-xs font-black text-slate-900 placeholder:text-slate-300 focus:bg-white focus:border-slate-900 transition-all font-sans"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] px-1">
                      Mobile Number <span className="text-red-500">*</span>
                    </label>
                    <div className="relative group">
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-slate-900 transition-colors">
                        <Smartphone size={16} />
                      </div>
                      <input
                        type="tel"
                        maxLength={10}
                        value={formData.mobile}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, "");
                          if (val.length <= 10) handleChange("mobile", val);
                        }}
                        placeholder="Mobile Number"
                        className="w-full h-12 pl-12 pr-4 bg-slate-50 border border-slate-200 rounded-sm outline-none text-xs font-black text-slate-900 placeholder:text-slate-300 focus:bg-white focus:border-slate-900 transition-all font-sans tracking-widest"
                      />
                    </div>
                  </div>

                  {/* Email + Password */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] px-1">
                      Email Address <span className="text-red-500">*</span>
                    </label>
                    <div className="relative group">
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-slate-900 transition-colors">
                        <Mail size={16} />
                      </div>
                      <input
                        type="email"
                        value={formData.email}
                        onChange={(e) => handleChange("email", e.target.value)}
                        placeholder="business@email.com"
                        className="w-full h-12 pl-12 pr-4 bg-slate-50 border border-slate-200 rounded-sm outline-none text-xs font-black text-slate-900 placeholder:text-slate-300 focus:bg-white focus:border-slate-900 transition-all font-sans"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] px-1">
                      Password <span className="text-red-500">*</span>
                    </label>
                    <div className="relative group">
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-slate-900 transition-colors">
                        <Lock size={16} />
                      </div>
                      <input
                        type={showPassword ? "text" : "password"}
                        value={formData.password}
                        onChange={(e) => handleChange("password", e.target.value)}
                        placeholder="Min. 6 characters"
                        className="w-full h-12 pl-12 pr-12 bg-slate-50 border border-slate-200 rounded-sm outline-none text-xs font-black text-slate-900 placeholder:text-slate-300 focus:bg-white focus:border-slate-900 transition-all font-sans"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((p) => !p)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-900 transition-colors"
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    {formData.password && formData.password.length < 6 && (
                      <p className="text-[10px] text-red-500 font-bold px-1">Min. 6 characters required</p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] px-1">
                        FSSAI Number
                      </label>
                      <div className="relative group">
                        <input
                          type="text"
                          inputMode="numeric"
                          maxLength={14}
                          value={formData.fssaiNumber}
                          onChange={(e) =>
                            handleChange("fssaiNumber", normalizeFssaiInput(e.target.value))
                          }
                          placeholder="14-digit FSSAI"
                          className={`w-full h-12 px-4 bg-slate-50 border rounded-sm outline-none text-xs font-black text-slate-900 placeholder:text-slate-300 focus:bg-white transition-all font-sans tracking-widest ${
                            formData.fssaiNumber && !isValidFssai(formData.fssaiNumber)
                              ? "border-red-400 focus:border-red-500"
                              : "border-slate-200 focus:border-slate-900"
                          }`}
                        />
                      </div>
                      {formData.fssaiNumber && !isValidFssai(formData.fssaiNumber) && (
                        <p className="text-[10px] text-red-500 font-bold px-1">Must be 14 digits</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] px-1">
                        GST Number
                      </label>
                      <div className="relative group">
                        <input
                          type="text"
                          maxLength={15}
                          value={formData.gstNumber}
                          onChange={(e) =>
                            handleChange("gstNumber", normalizeGstInput(e.target.value))
                          }
                          placeholder="GSTIN (15 chars)"
                          className={`w-full h-12 px-4 bg-slate-50 border rounded-sm outline-none text-xs font-black text-slate-900 placeholder:text-slate-300 focus:bg-white transition-all font-sans tracking-widest ${
                            formData.gstNumber && !isValidGst(formData.gstNumber)
                              ? "border-red-400 focus:border-red-500"
                              : "border-slate-200 focus:border-slate-900"
                          }`}
                        />
                      </div>
                      {formData.gstNumber && !isValidGst(formData.gstNumber) && (
                        <p className="text-[10px] text-red-500 font-bold px-1">Invalid GSTIN format</p>
                      )}
                    </div>
                  </div>

                  {/* Location Picker */}
                  <LocationSummary
                    formattedAddress={formData.formattedAddress}
                    onChangeLocation={() => setIsLocationModalOpen(true)}
                    required={true}
                  />

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] px-1">
                      Product Categories to Serve <span className="text-red-500">*</span>
                    </label>
                    <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto p-2 bg-slate-50 border border-slate-200 rounded-sm">
                      {isLoadingCategories ? (
                        <div className="col-span-2 flex items-center justify-center py-4">
                          <Loader2
                            className="animate-spin text-slate-400"
                            size={16}
                          />
                        </div>
                      ) : categories.length > 0 ? (
                        categories.map((cat) => (
                          <label
                            key={cat._id}
                            className="flex items-center gap-2 cursor-pointer group">
                            <input
                              type="checkbox"
                              checked={formData.servedCategories.includes(
                                cat._id,
                              )}
                              onChange={(e) => {
                                const checked = e.target.checked;
                                setFormData((prev) => ({
                                  ...prev,
                                  servedCategories: checked
                                    ? [...prev.servedCategories, cat._id]
                                    : prev.servedCategories.filter(
                                        (id) => id !== cat._id,
                                      ),
                                }));
                              }}
                              className="w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                            />
                            <span className="text-[10px] font-bold text-slate-600 group-hover:text-slate-900 uppercase tracking-tight transition-colors truncate">
                              {cat.name}
                            </span>
                          </label>
                        ))
                      ) : (
                        <div className="col-span-2 text-[10px] font-bold text-slate-400 text-center py-2 uppercase tracking-widest">
                          No categories found
                        </div>
                      )}
                    </div>
                  </div>

                  <button
                    disabled={
                      !formData.mobile ||
                      formData.mobile.length < 10 ||
                      !formData.franchiseName ||
                      !formData.location ||
                      !formData.email ||
                      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email) ||
                      !formData.password ||
                      formData.password.length < 6 ||
                      formData.servedCategories.length === 0 ||
                      (formData.fssaiNumber && !isValidFssai(formData.fssaiNumber)) ||
                      (formData.gstNumber && !isValidGst(formData.gstNumber))
                    }
                    className="w-full h-14 bg-slate-900 text-white rounded-sm font-black uppercase text-[11px] tracking-[0.3em] shadow-xl hover:bg-slate-800 active:scale-[0.98] transition-all disabled:bg-slate-200 disabled:text-slate-400 flex items-center justify-center gap-3 mt-4">
                    Register Now <ArrowRight size={16} />
                  </button>

                  <button
                    type="button"
                    onClick={() => navigate("/franchise/login")}
                    className="w-full text-[10px] font-black text-slate-400 uppercase tracking-widest py-2 hover:text-slate-900 transition-colors underline underline-offset-8 decoration-slate-200">
                    Already a franchise? Login
                  </button>
                </motion.div>
              ) : (
                <motion.div
                  key="otp-input"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="space-y-6">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex justify-between items-center px-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">
                          Verify Mobile Number
                        </label>
                        <span className="flex items-center gap-2">
                          <span className="text-[10px] font-bold text-slate-400">
                            {formData.mobile}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setOtp(["", "", "", "", "", ""]);
                              setMode("details");
                            }}
                            className="flex items-center gap-1 text-[10px] font-black text-slate-900 uppercase tracking-widest underline underline-offset-4">
                            <Pencil size={11} /> Edit number
                          </button>
                        </span>
                      </div>

                      <div className="flex gap-2 justify-between">
                        {otp.map((digit, index) => (
                          <input
                            key={index}
                            ref={otpRefs[index]}
                            type="text"
                            inputMode="numeric"
                            maxLength={1}
                            value={digit}
                            onChange={(e) =>
                              handleOtpChange(index, e.target.value)
                            }
                            onKeyDown={(e) => handleKeyDown(index, e)}
                            className="w-12 h-14 bg-slate-50 border border-slate-200 rounded-sm outline-none text-lg font-black text-slate-900 text-center focus:bg-white focus:border-slate-900 transition-all font-sans"
                            autoFocus={index === 0}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col gap-4">
                    <button
                      className="w-full h-14 bg-slate-900 text-white rounded-sm font-black uppercase text-[11px] tracking-[0.3em] shadow-xl hover:bg-slate-800 active:scale-[0.98] transition-all flex items-center justify-center gap-3 disabled:bg-slate-200 disabled:text-slate-400"
                      disabled={isLoading || otp.join("").length < 6}>
                      {isLoading ? (
                        <Loader2 className="animate-spin" size={16} />
                      ) : (
                        <>
                          Confirm Registration <ShieldCheck size={16} />
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={handleResendOtp}
                      disabled={timer > 0 || isLoading}
                      className="text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-900 transition-colors underline underline-offset-8 decoration-slate-200 disabled:opacity-50 disabled:hover:text-slate-400">
                      {timer > 0
                        ? `Resend Code in ${formatTime(timer)}`
                        : "Resend OTP"}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </form>

          <div className="pt-12 border-t border-slate-100 flex flex-col items-center gap-6">
            <div className="flex items-center gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">
                All systems working
              </span>
            </div>
            <p className="text-[10px] text-slate-300 font-bold uppercase tracking-widest text-center leading-relaxed">
                By registering, you agree to our <button type="button" onClick={() => navigate('/franchise/terms')} className="text-slate-900 border-b border-slate-900">Franchise Terms & Conditions</button>.
            </p>
          </div>
        </motion.div>
      </div>

      {/* Location Picker Modal */}
      <LocationPickerModal
        isOpen={isLocationModalOpen}
        onClose={() => setIsLocationModalOpen(false)}
        onConfirm={handleLocationConfirm}
        initialLocation={formData.location}
        defaultCity={formData.city}
        defaultState={formData.state}
      />
    </div>
  );
}
