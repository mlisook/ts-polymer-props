export const sample1 = 
`import { PolymerElement, html } from '@polymer/polymer/polymer-element.js';
import '@polymer/paper-styles/shadow.js';
import '@polymer/iron-flex-layout/iron-flex-layout-classes.js';
import '@polymer/paper-input/paper-textarea.js';
import '@polymer/paper-input/paper-input.js';
import '@polymer/paper-button/paper-button.js';
import '../shared-styles/shared-styles.js';
import { GestureEventListeners } from '@polymer/polymer/lib/mixins/gesture-event-listeners.js';
class CommentForm extends GestureEventListeners(PolymerElement) {
  static get template() {
    return html\`
        <style include="shared-styles iron-flex iron-flex-alignment iron-flex-factors">
             :host {
                display: block;
                position: static;
                box-sizing: border-box;
                padding-top: 8px;
            }

            
        </style>
        <div id="postcomments">
        </div>
        <div>
            <div class="list-card-content">
                <div class="rb-dc-title-container">
                    <div class="rb-dc-title">Leave a Reply</div>
                </div>
                <div class="layout vertical comment-form">
                    <!-- reply form -->
                    <paper-textarea id="commentText" value="{{comment_text}}" class="form-field" always-float-label="" label="Comment *" rows="5"></paper-textarea>
                    <paper-input id="commenterName" value="{{author_name}}" class="form-field" label="Name *"></paper-input>
                    <paper-input id="commenterEmail" value="{{author_email}}" class="form-field" label="Email * - your email will not be published"></paper-input>
                    <div id="message" class="error-message">[[_errorMessage]]</div>
                    <div id="succcess" class="success-message">[[_successMessage]]</div>
                    <paper-button id="submitComment" class="form-button" raised="" on-tap="_postComment">Submit Reply</paper-button>
                </div>
            </div>
        </div>
\`;
  }

  static get is() {
      return 'comment-form';
  }

  // @polyProp
  author_email!: string;
  // @polyProp
  postId!: number;
  // @polyProp {value: () => { return []; }, notify: true, observer: "_commentsChanged"}
  _commentsForPost!: Icomment[];
  nonPolymerProperty: string;
  /**
   * a very special property
   * @polyProp
   */
  verySpecial: Ispecial;
  /**
   * @polyProp {notify:true, value: {}}
   */
  somewhatSpecial: any;

  static get properties() {
      return {

          postId: {
              type: Number,
              value: 0,
              notify: true,
              observer: "_postIdObserver"
          },
          author_email: String,
          author_name: String,
          comment_text: String,
          _errorMessage: {
              type: String,
              value: "",
              notify: true
          },
          _successMessage: {
              type: String,
              value: "",
              notify: true
          },
          _isValid: Boolean,
          /**
           * Array of comments for displayed post
           * @type {Icomment[]}
           */
          _commentsForPost: {
              type: Array,
              value: () => {
                  return [];
              },
              notify: true,
              observer: "_commentsChanged"
          }
      };
  }
  /**
   * initialize component
   */
  ready() {
      super.ready();
  }

  _loadCommentsForPost() {
  }
  /**
   * handle a change to the comments array
   */
  _commentsChanged(n, o) {
  }

  _postComment() {
  }

  /**
   * check that the required inputs are valid
   */
  _validate() {
  }
  /**
   * checks a candidate email address to determine if it is formatted properly
   * @param {string} mail the candidate email address
   * @return {Boolean}
   */
  _validateEmail(mail) {
      return (/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/.test(mail))
  }
  /**
   * handle a change to the post id
   */
  _postIdObserver(n, o) {
  }
}

window.customElements.define(CommentForm.is, CommentForm);
`;