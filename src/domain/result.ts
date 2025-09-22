/**
 * Result pattern for better error handling
 */
export class Result<T, E = Error> {
	private constructor(
		private readonly _isSuccess: boolean,
		private readonly _value?: T,
		private readonly _error?: E
	) {}

	public static success<T>(value: T): Result<T, never> {
		return new Result<T, never>(true, value, undefined)
	}

	public static failure<E>(error: E): Result<never, E> {
		return new Result<never, E>(false, undefined, error)
	}

	public isSuccess(): boolean {
		return this._isSuccess
	}

	public isFailure(): boolean {
		return !this._isSuccess
	}

	public getValue(): T {
		if (!this._isSuccess) {
			throw new Error('Cannot get value from failed result')
		}
		return this._value!
	}

	public getError(): E {
		if (this._isSuccess) {
			throw new Error('Cannot get error from successful result')
		}
		return this._error!
	}

	public map<U>(fn: (value: T) => U): Result<U, E> {
		if (this._isSuccess) {
			try {
				return Result.success(fn(this._value!)) as Result<U, E>
			} catch (error) {
				return Result.failure(error as E)
			}
		}
		return Result.failure(this._error!)
	}

	public flatMap<U>(fn: (value: T) => Result<U, E>): Result<U, E> {
		if (this._isSuccess) {
			return fn(this._value!)
		}
		return Result.failure(this._error!)
	}

	public match<U>(onSuccess: (value: T) => U, onFailure: (error: E) => U): U {
		return this._isSuccess ? onSuccess(this._value!) : onFailure(this._error!)
	}
}
