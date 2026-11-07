const ZONES = ['America/New_York', 'America/Chicago', 'America/Denver', 'America/Phoenix', 'America/Los_Angeles', 'America/Anchorage', 'Pacific/Honolulu'];

export function TimezoneSelect({ value = 'America/Chicago' }) {
    return (
        <div>
            <label className="label" htmlFor="timezone">
                Time zone
            </label>
            <select id="timezone" name="timezone" defaultValue={value} className="field">
                {ZONES.map((z) => (
                    <option key={z} value={z}>
                        {z.replace('America/', '').replace('Pacific/', '').replace('_', ' ')}
                    </option>
                ))}
            </select>
        </div>
    );
}
