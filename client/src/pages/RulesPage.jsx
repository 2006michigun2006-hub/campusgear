import { PageHeader } from '../components.jsx';
import { useApp } from '../util.js';

export default function RulesPage() {
  const { rules } = useApp();
  return (
    <>
      <PageHeader crumbs={[['Loan rules']]} title="Loan rules" lead="These rules apply during the pilot and may change after review with the desk and IT staff." />
      <div className="container content prose">
        <h2>Who can borrow</h2>
        <p>Any registered student can reserve equipment. Desk staff accounts are issued by the service; they cannot be created through registration.</p>

        <h2>Booking a loan</h2>
        <table className="data-table rules-table">
          <tbody>
            <tr><th scope="row">Pickup days</th><td>{rules.weekdaysOnly ? 'Monday to Friday' : 'Any day'}</td></tr>
            <tr><th scope="row">Pickup time</th><td>On the hour, {rules.openHour}:00–{rules.closeHour - 1}:00</td></tr>
            <tr><th scope="row">Return time</th><td>On the hour, {rules.openHour}:00–{rules.closeHour}:00</td></tr>
            <tr><th scope="row">How far ahead</th><td>{rules.minLeadDays} to {rules.maxLeadDays} days before pickup</td></tr>
            <tr><th scope="row">Loan length</th><td>{rules.minHours} to {rules.maxHours} hours</td></tr>
            <tr><th scope="row">Active bookings</th><td>One active booking per item and student</td></tr>
            <tr><th scope="row">Time zone</th><td>{rules.timeZone}</td></tr>
          </tbody>
        </table>

        <h2>Cancelling</h2>
        <p>You can cancel a booking from <a href="#/my">My loans</a> until the item has been handed to you. The time becomes free for other students immediately.</p>

        <h2>Pickup and return</h2>
        <p>Collect the item at the pickup point shown on the item page; the desk marks it as handed over. If you return an item early, the remaining time is released. Late returns are recorded and the desk will follow up; the pilot does not charge fees.</p>

        <h2>Faulty equipment</h2>
        <p>If an item is withdrawn for repair, new bookings are closed. Existing bookings are not deleted: the desk will contact you to arrange an alternative.</p>
      </div>
    </>
  );
}
