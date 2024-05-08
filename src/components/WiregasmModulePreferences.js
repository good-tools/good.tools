import { PrefType } from "@goodtools/wiregasm";
import CheckBox from "./CheckBox";
import { useId, useState } from "react";
import FileButton from "./FileButton";

const PREF_CATEGORIES = {
  boolean: [PrefType.PREF_BOOL],
  enum: [PrefType.PREF_ENUM],
  string: [PrefType.PREF_STRING, PrefType.PREF_DIRNAME, PrefType.PREF_PASSWORD],
  file: [PrefType.PREF_OPEN_FILENAME],
  number: [PrefType.PREF_UINT],
  range: [PrefType.PREF_RANGE, PrefType.PREF_DECODE_AS_RANGE],
};

function BooleanPreference({ pref, updatePreferenceValue }) {
  const [checked, setChecked] = useState(pref.bool_value);

  const toggle = () => {
    const value = !checked;
    updatePreferenceValue(pref.name, value.toString()).then(() => {
      setChecked(value);
    });
  };

  return (
    <CheckBox
      title={pref.title}
      description={pref.description}
      checked={checked}
      onChange={toggle}
    />
  );
}

function EnumPreference({ pref, updatePreferenceValue }) {
  const [value, setValue] = useState(
    pref.enum_value.filter((opt) => opt.selected)[0].name
  );

  const handleChange = (e) => {
    const value = e.target.value;
    updatePreferenceValue(pref.name, value).then(() => {
      setValue(value);
    });
  };

  const id = useId();
  return (
    <div className="mb-2">
      <div className="text-sm">
        <label
          htmlFor={id}
          title={pref.description}
          className="text-zinc-700 dark:text-zinc-300"
        >
          {pref.title}
        </label>
      </div>
      <div className="w-full h-6 items-center">
        <select
          id={id}
          name={id}
          onChange={handleChange}
          value={value}
          className="w-full text-sm p-0 pl-1 rounded border-gray-300 text-zinc-600 focus:ring-zinc-500"
        >
          {pref.enum_value.map((option, idx) => (
            <option key={`opt-${idx}`} value={option.name}>
              {option.description}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

function FilePreference({ pref, uploadFile, updatePreferenceValue }) {
  const [value, setValue] = useState(pref.string_value);
  const [error, setError] = useState(null);

  const handleChange = (e) => {
    setError(null);

    if (!e.target.files) {
      return;
    }

    if (e.target.files.length === 0) {
      return;
    }

    const f = e.target.files[0];

    uploadFile(f).then((path) => {
      updatePreferenceValue(pref.name, path)
        .then(() => {
          setValue(path);
        })
        .catch((err) => {
          setError(err);
        });
    });
  };

  const id = useId();
  return (
    <div className="">
      <div className="text-sm">
        <label
          htmlFor={id}
          title={pref.description}
          className="text-zinc-700 dark:text-zinc-300"
        >
          {pref.title}
        </label>
      </div>
      <div className="w-full h-6 items-center">
        <input
          id={id}
          name={id}
          type="text"
          value={value}
          readOnly
          className="h-6 rounded border-gray-300 text-zinc-600 focus:ring-zinc-500"
        />
        <FileButton
          variant="outline"
          className="ml-2 py-0"
          onFileSelected={handleChange}
        >
          Browse...
        </FileButton>
      </div>
      {error && <div className="text-xs text-red-500">{error}</div>}
    </div>
  );
}

function RangePreference({ pref, updatePreferenceValue }) {
  const [value, setValue] = useState(pref.range_value);
  const [error, setError] = useState(null);

  const handleChange = (e) => {
    setError(null);
    setValue(e.target.value);
  };

  const applyValue = () => {
    setError(null);
    updatePreferenceValue(pref.name, value)
      .then(() => {})
      .catch((err) => {
        setError(err);
      });
  };

  const id = useId();
  return (
    <div className="">
      <div className="text-sm">
        <label
          htmlFor={id}
          title={pref.description}
          className="text-zinc-700 dark:text-zinc-300"
        >
          {pref.title}
        </label>
      </div>
      <div className="w-full h-6 items-center">
        <input
          id={id}
          name={id}
          type="text"
          value={value}
          onChange={handleChange}
          onBlur={applyValue}
          className="h-6 w-full rounded border-gray-300 text-zinc-600 focus:ring-zinc-500"
        />
      </div>
      {error && <div className="text-xs text-red-500">{error}</div>}
    </div>
  );
}

function NumberPreference({ pref, updatePreferenceValue }) {
  const [value, setValue] = useState(pref.uint_value);
  const [error, setError] = useState(null);

  const handleChange = (e) => {
    setError(null);
    setValue(parseInt(e.target.value, 10) || 0);
  };

  const applyValue = () => {
    setError(null);
    updatePreferenceValue(pref.name, value)
      .then(() => {})
      .catch((err) => {
        setError(err);
      });
  };

  const id = useId();
  return (
    <div className="relative flex items-start">
      <div className="text-sm">
        <label htmlFor={id} className="text-zinc-700 dark:text-zinc-300">
          {pref.title}
        </label>
      </div>
      <div className="ml-3 flex h-6 items-center">
        <input
          id={id}
          name={id}
          type="text"
          value={value}
          onChange={handleChange}
          onBlur={applyValue}
          className="h-6 rounded border-gray-300 text-zinc-600 focus:ring-zinc-500"
        />
      </div>
      {error && <div className="text-xs text-red-500">{error}</div>}
    </div>
  );
}

function StringPreference({ pref, updatePreferenceValue }) {
  const [value, setValue] = useState(pref.string_value);
  const [error, setError] = useState(null);

  const handleChange = (e) => {
    setError(null);
    setValue(e.target.value);
  };

  const applyValue = () => {
    setError(null);
    updatePreferenceValue(pref.name, value)
      .then(() => {})
      .catch((err) => {
        setError(err);
      });
  };

  const id = useId();
  return (
    <div className="">
      <div className="text-sm">
        <label
          htmlFor={id}
          title={pref.description}
          className="text-zinc-700 dark:text-zinc-300"
        >
          {pref.title}
        </label>
      </div>
      <div className="w-full h-6 items-center">
        <input
          id={id}
          name={id}
          type="text"
          value={value}
          onChange={handleChange}
          onBlur={applyValue}
          className="h-6 w-full rounded border-gray-300 text-zinc-600 focus:ring-zinc-500"
        />
      </div>
      {error && <div className="text-xs text-red-500">{error}</div>}
    </div>
  );
}

function PreferenceItem({ pref, uploadFile, updatePreferenceValue }) {
  if (PREF_CATEGORIES["boolean"].includes(pref.type)) {
    return (
      <BooleanPreference
        pref={pref}
        updatePreferenceValue={updatePreferenceValue}
      />
    );
  }

  if (PREF_CATEGORIES["file"].includes(pref.type)) {
    return (
      <FilePreference
        pref={pref}
        uploadFile={uploadFile}
        updatePreferenceValue={updatePreferenceValue}
      />
    );
  }

  if (PREF_CATEGORIES["range"].includes(pref.type)) {
    return (
      <RangePreference
        pref={pref}
        updatePreferenceValue={updatePreferenceValue}
      />
    );
  }

  if (PREF_CATEGORIES["number"].includes(pref.type)) {
    return (
      <NumberPreference
        pref={pref}
        updatePreferenceValue={updatePreferenceValue}
      />
    );
  }

  if (PREF_CATEGORIES["string"].includes(pref.type)) {
    return (
      <StringPreference
        pref={pref}
        updatePreferenceValue={updatePreferenceValue}
      />
    );
  }

  if (PREF_CATEGORIES["enum"].includes(pref.type)) {
    return (
      <EnumPreference
        pref={pref}
        updatePreferenceValue={updatePreferenceValue}
      />
    );
  }

  return <></>;
}

function WiregasmModulePreferences({
  preferences,
  uploadFile,
  updatePreferenceValue,
}) {
  if (!preferences) {
    return <div>Loading...</div>;
  }

  return (
    <div className="text-sm">
      <ul>
        {preferences.map((preference, idx) => (
          <li key={`pi-${idx}`}>
            <PreferenceItem
              pref={preference}
              uploadFile={uploadFile}
              updatePreferenceValue={updatePreferenceValue}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

export default WiregasmModulePreferences;
