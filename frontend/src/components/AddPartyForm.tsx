import { useState, FormEvent } from "react";
import { addParty } from "../api";

interface Props {
  onAdded: () => void;
}

export function AddPartyForm({ onAdded }: Props) {
  const [name, setName] = useState("");
  const [size, setSize] = useState("2");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    if (!size || parseInt(size, 10) < 1) {
      setError("Party size must be at least 1.");
      return;
    }
    if (!phone.trim()) {
      setError("Phone number is required.");
      return;
    }

    setSubmitting(true);
    try {
      await addParty({ name, size, phone });
      setName("");
      setSize("2");
      setPhone("");
      onAdded();
    } catch {
      setError("Failed to add party. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="add-party-form">
      <h3>Add Party</h3>
      {error && <div className="error-message">{error}</div>}
      <div className="form-row">
        <input
          type="text"
          placeholder="Party name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="input w-full"
          autoFocus
        />
      </div>
      <div className="form-row form-row-inline">
        <input
          type="number"
          placeholder="Size"
          value={size}
          onChange={(e) => setSize(e.target.value)}
          className="input input-small"
          min="1"
        />
        <input
          type="tel"
          placeholder="Phone number"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="input w-full"
        />
      </div>
      <button
        type="submit"
        className="btn btn-primary"
        disabled={submitting || !name.trim() || !phone.trim()}
      >
        {submitting ? "Adding..." : "Add to Waitlist"}
      </button>
    </form>
  );
}
